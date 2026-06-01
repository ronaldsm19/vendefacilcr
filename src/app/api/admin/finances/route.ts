import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Sale } from "@/models/Sale";
import { Expense } from "@/models/Expense";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "month";

  const now = new Date();
  // Costa Rica = UTC-6, sin horario de verano. Todos los cortes de fecha usan medianoche CR.
  const CR_OFFSET = 6 * 60 * 60 * 1000;
  const nowCR = new Date(now.getTime() - CR_OFFSET); // "now" expresado como UTC pero con offset CR
  const TZ = "America/Costa_Rica";

  let startDate: Date;
  let groupFormat: string;

  if (period === "week") {
    // 28 días atrás desde medianoche CR de hoy
    const d = new Date(Date.UTC(nowCR.getUTCFullYear(), nowCR.getUTCMonth(), nowCR.getUTCDate() - 28));
    startDate = new Date(d.getTime() + CR_OFFSET);
    groupFormat = "%Y-%U";
  } else {
    // Primer día del mes, hace 12 meses, a medianoche CR
    const d = new Date(Date.UTC(nowCR.getUTCFullYear() - 1, nowCR.getUTCMonth(), 1));
    startDate = new Date(d.getTime() + CR_OFFSET);
    groupFormat = "%Y-%m";
  }

  const tenantOid = new mongoose.Types.ObjectId(session.tenantId);

  // ── Aggregations paralelas ────────────────────────────────────────────────
  const [
    ordersRevByPeriod,
    salesRevByPeriod,
    expensesByPeriod,
    ordersRevByProduct,
    salesRevByProduct,
    expensesByCategory,
    ordersTotals,
    salesTotals,
    totalExpenses,
  ] = await Promise.all([
    // Ingresos de pedidos pagados por período
    Order.aggregate([
      { $match: { tenantId: tenantOid, paid: true, orderedAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$orderedAt", timezone: TZ } }, revenue: { $sum: "$total" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    // Ingresos de ventas POS por período
    Sale.aggregate([
      { $match: { tenantId: tenantOid, saleDate: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$saleDate", timezone: TZ } }, revenue: { $sum: "$total" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    // Gastos por período
    Expense.aggregate([
      { $match: { tenantId: tenantOid, date: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$date", timezone: TZ } }, expenses: { $sum: "$total" } } },
      { $sort: { _id: 1 } },
    ]),
    // Ingresos por producto (pedidos) — los pedidos tienen productName en la raíz
    Order.aggregate([
      { $match: { tenantId: tenantOid, paid: true, orderedAt: { $gte: startDate } } },
      { $group: { _id: "$productName", revenue: { $sum: "$total" }, units: { $sum: 1 } } },
      { $sort: { revenue: -1 } }, { $limit: 10 },
    ]),
    // Ingresos por producto (ventas POS) — unwind items
    Sale.aggregate([
      { $match: { tenantId: tenantOid, saleDate: { $gte: startDate } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productName", revenue: { $sum: "$items.lineTotal" }, units: { $sum: "$items.quantity" } } },
      { $sort: { revenue: -1 } }, { $limit: 10 },
    ]),
    // Gastos por categoría
    Expense.aggregate([
      { $match: { tenantId: tenantOid, date: { $gte: startDate } } },
      { $group: { _id: "$category", total: { $sum: "$total" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    // Totales de pedidos
    Order.aggregate([
      { $match: { tenantId: tenantOid, paid: true, orderedAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    // Totales de ventas POS
    Sale.aggregate([
      { $match: { tenantId: tenantOid, saleDate: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    // Totales de gastos
    Expense.aggregate([
      { $match: { tenantId: tenantOid, date: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  // ── Merge revenueByPeriod ─────────────────────────────────────────────────
  const periodMap = new Map<string, { revenue: number; count: number }>();
  for (const r of ordersRevByPeriod) {
    periodMap.set(r._id, { revenue: r.revenue, count: r.count });
  }
  for (const r of salesRevByPeriod) {
    const existing = periodMap.get(r._id);
    if (existing) {
      existing.revenue += r.revenue;
      existing.count   += r.count;
    } else {
      periodMap.set(r._id, { revenue: r.revenue, count: r.count });
    }
  }
  const revenueByPeriod = Array.from(periodMap.entries())
    .map(([_id, v]) => ({ _id, revenue: v.revenue, orders: v.count }))
    .sort((a, b) => a._id.localeCompare(b._id));

  // ── Merge revenueByProduct ────────────────────────────────────────────────
  const productMap = new Map<string, { revenue: number; units: number }>();
  for (const p of ordersRevByProduct) {
    if (p._id) productMap.set(p._id, { revenue: p.revenue, units: p.units ?? 1 });
  }
  for (const p of salesRevByProduct) {
    if (!p._id) continue;
    const existing = productMap.get(p._id);
    if (existing) {
      existing.revenue += p.revenue;
      existing.units   += p.units;
    } else {
      productMap.set(p._id, { revenue: p.revenue, units: p.units });
    }
  }
  const revenueByProduct = Array.from(productMap.entries())
    .map(([_id, v]) => ({ _id, revenue: v.revenue, orders: v.units }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── Totales combinados ────────────────────────────────────────────────────
  const revenue  = (ordersTotals[0]?.total ?? 0) + (salesTotals[0]?.total ?? 0);
  const expenses = totalExpenses[0]?.total ?? 0;
  const totalTransactions = (ordersTotals[0]?.count ?? 0) + (salesTotals[0]?.count ?? 0);

  return NextResponse.json({
    summary: {
      revenue,
      expenses,
      profit:             revenue - expenses,
      margin:             revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0,
      totalTransactions,
    },
    revenueByPeriod,
    expensesByPeriod,
    revenueByProduct,
    expensesByCategory,
  });
}
