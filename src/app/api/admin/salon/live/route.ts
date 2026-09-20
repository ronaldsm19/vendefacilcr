import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { TableArea } from "@/models/TableArea";
import { SalonTable } from "@/models/SalonTable";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";
import { isTableStatus } from "@/lib/tableStatus";
import { readComandaConfig } from "@/lib/comandaConfig";

// FASE 3: reemplazar estos valores fijos por la agregación de Comanda
// (status in ["enviada","servida"] agrupado por tableId): openCount, activeAvgMinutes
// (promedio de minutos desde sentAt de las "enviada"), oldestSentAt, waiterNames (únicos).
// Fase 3 le agrega el parámetro `tableId` cuando pase a leer la agregación por mesa; dejarlo
// sin parámetro ahora evita un warning de @typescript-eslint/no-unused-vars (prefijar con `_`
// tampoco lo evita: la regla también reporta `_tableId`).
const comandaStats = () => ({ openCount: 0, activeAvgMinutes: null as number | null, oldestSentAt: null as string | null, waiterNames: [] as string[] });

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const [areas, tables, tenant] = await Promise.all([
    TableArea.find({ tenantId: session.tenantId }).sort({ order: 1 }).select("name color order").lean(),
    SalonTable.find({ tenantId: session.tenantId })
      .select("areaId label shape seats x y status statusNote occupiedAt dirtyAt")
      .lean(),
    Tenant.findById(session.tenantId).select("comandaConfig").lean() as Promise<{ comandaConfig?: { warnMinutes?: number; alertMinutes?: number } } | null>,
  ]);

  const response = NextResponse.json({
    now: new Date().toISOString(),
    comandaConfig: readComandaConfig(tenant?.comandaConfig),
    areas: areas.map((a) => ({
      _id: String(a._id),
      name: a.name,
      color: a.color,
      order: a.order,
    })),
    tables: tables.map((t) => ({
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
      ...comandaStats(),
    })),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
