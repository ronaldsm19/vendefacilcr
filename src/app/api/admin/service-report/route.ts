import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale } from "@/models/Sale";
import { WorkShift } from "@/models/WorkShift";
import { getSession, requireRole } from "@/lib/auth";
import { distributeProportionally } from "@/lib/proportionalRounding";
import type { Role } from "@/lib/permissions";

interface WorkerAgg {
  _id: string;
  name: string;
  role: Role;
  minutes: number;
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

  const [serviceAgg, workersAgg] = await Promise.all([
    Sale.aggregate([
      { $match: { tenantId: tenantOid, serviceEnabled: true, saleDate: { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: "$serviceAmount" }, count: { $sum: 1 } } },
    ]),
    WorkShift.aggregate<WorkerAgg>([
      { $match: { tenantId: tenantOid, status: "cerrada", startedAt: { $gte: from, $lt: to } } },
      { $group: { _id: "$staffUserId", name: { $last: "$staffName" }, role: { $last: "$staffRole" }, minutes: { $sum: "$minutes" } } },
      { $sort: { minutes: -1 } },
    ]),
  ]);

  const serviceTotal = serviceAgg[0]?.total ?? 0;
  const salesCount = serviceAgg[0]?.count ?? 0;
  const totalMinutes = workersAgg.reduce((sum, w) => sum + w.minutes, 0);

  const amounts = distributeProportionally(serviceTotal, workersAgg.map((w) => w.minutes));

  const workers = workersAgg.map((w, i) => ({
    staffUserId: w._id,
    name: w.name,
    role: w.role,
    minutes: w.minutes,
    share: totalMinutes > 0 ? w.minutes / totalMinutes : 0,
    amount: amounts[i],
  }));

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    serviceTotal,
    salesCount,
    totalMinutes,
    workers,
  });
}
