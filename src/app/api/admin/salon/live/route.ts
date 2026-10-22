import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { TableArea } from "@/models/TableArea";
import { SalonTable } from "@/models/SalonTable";
import { Tenant } from "@/models/Tenant";
import { Comanda } from "@/models/Comanda";
import { PrintJob } from "@/models/PrintJob";
import { getSession } from "@/lib/auth";
import { isTableStatus } from "@/lib/tableStatus";
import { readComandaConfig } from "@/lib/comandaConfig";

/**
 * El agente de la PC toma cada comanda en pocos segundos (consulta cada 2,5 s). Una que lleva
 * más de esto esperando significa que nadie la está tomando: el agente está apagado, trabado o
 * con el token equivocado, y en la cocina no salió nada.
 */
const PRINT_STUCK_MS = 60_000;

interface ComandaStatsRow {
  _id: mongoose.Types.ObjectId;
  openCount: number;
  oldestSentAt: Date;
  waiterNames: string[];
  activeMinutes: (number | null)[];
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const now = new Date();
  const pendingPrint = { tenantId: session.tenantId, type: "comanda", status: "pending" };
  const [areas, tables, tenant, comandaRows, oldestPendingPrint, pendingPrintCount] = await Promise.all([
    TableArea.find({ tenantId: session.tenantId }).sort({ order: 1 }).select("name color order").lean(),
    SalonTable.find({ tenantId: session.tenantId })
      .select("areaId label shape seats x y status statusNote occupiedAt dirtyAt")
      .lean(),
    Tenant.findById(session.tenantId).select("comandaConfig plan printAgentLastSeenAt").lean() as Promise<{
      comandaConfig?: { warnMinutes?: number; alertMinutes?: number };
      plan?: string;
      printAgentLastSeenAt?: Date | null;
    } | null>,
    Comanda.aggregate<ComandaStatsRow>([
      { $match: { tenantId: new mongoose.Types.ObjectId(session.tenantId), status: { $in: ["enviada", "servida"] } } },
      { $group: {
          _id: "$tableId",
          openCount: { $sum: 1 },
          oldestSentAt: { $min: "$sentAt" },
          waiterNames: { $addToSet: "$waiterName" },
          activeMinutes: { $push: { $cond: [ { $eq: ["$status", "enviada"] }, { $divide: [ { $subtract: [now, "$sentAt"] }, 60000 ] }, null ] } },
      } },
    ]),
    PrintJob.findOne(pendingPrint).sort({ createdAt: 1 }).select("createdAt").lean() as Promise<{ createdAt: Date } | null>,
    PrintJob.countDocuments(pendingPrint),
  ]);

  // Solo premium imprime comandas. El aviso sale cuando la más vieja en espera pasó el límite.
  const printAlert = tenant?.plan === "premium" && oldestPendingPrint
    && now.getTime() - new Date(oldestPendingPrint.createdAt).getTime() >= PRINT_STUCK_MS
    ? {
        pendingCount: pendingPrintCount,
        oldestPendingAt: new Date(oldestPendingPrint.createdAt).toISOString(),
        agentLastSeenAt: tenant.printAgentLastSeenAt ? new Date(tenant.printAgentLastSeenAt).toISOString() : null,
      }
    : null;

  const statsByTable = new Map(comandaRows.map((r) => {
    const nonNull = r.activeMinutes.filter((m): m is number => m !== null);
    const activeAvgMinutes = nonNull.length > 0
      ? Math.round(nonNull.reduce((s, m) => s + m, 0) / nonNull.length)
      : null;
    return [String(r._id), {
      openCount: r.openCount,
      activeAvgMinutes,
      oldestSentAt: r.oldestSentAt ? new Date(r.oldestSentAt).toISOString() : null,
      waiterNames: r.waiterNames,
    }];
  }));

  const response = NextResponse.json({
    now: now.toISOString(),
    comandaConfig: readComandaConfig(tenant?.comandaConfig),
    printAlert,
    areas: areas.map((a) => ({
      _id: String(a._id),
      name: a.name,
      color: a.color,
      order: a.order,
    })),
    tables: tables.map((t) => {
      const stats = statsByTable.get(String(t._id));
      return {
        _id: String(t._id),
        areaId: String(t.areaId),
        label: t.label,
        shape: t.shape,
        seats: t.seats,
        x: t.x,
        y: t.y,
        status: isTableStatus(t.status) ? t.status : "libre",
        statusNote: t.statusNote ?? "",
        occupiedAt: t.occupiedAt ?? null,
        dirtyAt: t.dirtyAt ?? null,
        openCount: stats?.openCount ?? 0,
        activeAvgMinutes: stats?.activeAvgMinutes ?? null,
        oldestSentAt: stats?.oldestSentAt ?? null,
        waiterNames: stats?.waiterNames ?? [],
      };
    }),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
