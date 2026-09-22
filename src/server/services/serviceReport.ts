import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale } from "@/models/Sale";
import { WorkShift } from "@/models/WorkShift";
import { distributeProportionally } from "@/lib/proportionalRounding";
import type { PeriodRange } from "@/lib/workPeriod";
import type { StaffRole } from "@/models/StaffUser";

interface WorkerAgg {
  _id: { toString(): string };
  name: string;
  role: StaffRole;
  minutes: number;
}

/**
 * Reparto del 10% de servicio del rango entre el personal, en proporción a los minutos de sus turnos
 * CERRADOS que empezaron en el rango. Solo lee ventas y turnos. Los montos suman exactamente
 * serviceTotal (redondeo por mayor residuo); sin horas en el período, todos los montos son cero.
 * Los pedidos de la tienda web (Order) no cobran 10% y no cuentan.
 */
export async function computeServiceReport(tenantId: string, { from, to }: PeriodRange) {
  await connectToDatabase();
  const tenantOid = new mongoose.Types.ObjectId(tenantId);

  const [serviceAgg, workersAgg] = await Promise.all([
    Sale.aggregate<{ total: number; count: number }>([
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

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    serviceTotal,
    salesCount,
    totalMinutes,
    workers: workersAgg.map((w, i) => ({
      staffUserId: w._id.toString(),
      name: w.name,
      role: w.role,
      minutes: w.minutes,
      share: totalMinutes > 0 ? w.minutes / totalMinutes : 0,
      amount: amounts[i],
    })),
  };
}
