import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { WorkShift } from "@/models/WorkShift";
import { getSession, requireRole } from "@/lib/auth";

interface TotalRow {
  _id: string;
  name: string;
  role: string;
  minutes: number;
  shiftsCount: number;
  openCount: number;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  await connectToDatabase();
  const tenantOid = new mongoose.Types.ObjectId(session.tenantId);

  const [shifts, totalsRaw, openShifts] = await Promise.all([
    WorkShift.find({ tenantId: session.tenantId, startedAt: { $gte: from, $lt: to } })
      .select("-tenantId -__v")
      .sort({ startedAt: -1 })
      .lean(),
    WorkShift.aggregate<TotalRow>([
      { $match: { tenantId: tenantOid, startedAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: "$staffUserId",
          name: { $last: "$staffName" },
          role: { $last: "$staffRole" },
          minutes: { $sum: { $cond: [{ $eq: ["$status", "cerrada"] }, "$minutes", 0] } },
          shiftsCount: { $sum: 1 },
          openCount: { $sum: { $cond: [{ $eq: ["$status", "abierta"] }, 1, 0] } },
        },
      },
      { $sort: { minutes: -1 } },
    ]),
    // Turnos abiertos de todo el negocio, sin importar el rango: un turno olvidado puede haber
    // empezado antes del período que se está viendo, y sigue siendo un pendiente igual.
    WorkShift.find({ tenantId: session.tenantId, status: "abierta" })
      .select("staffUserId staffName staffRole startedAt")
      .sort({ startedAt: 1 })
      .lean(),
  ]);

  return NextResponse.json({
    shifts,
    totals: totalsRaw.map((t) => ({
      staffUserId: t._id,
      name: t.name,
      role: t.role,
      minutes: t.minutes,
      shiftsCount: t.shiftsCount,
      openCount: t.openCount,
    })),
    openShifts,
  });
}
