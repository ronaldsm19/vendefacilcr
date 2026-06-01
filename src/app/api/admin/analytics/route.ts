import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ProductClick } from "@/models/ProductClick";
import { Order } from "@/models/Order";
import { Sale } from "@/models/Sale";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const now = new Date();
  // Costa Rica = UTC-6 sin DST. Medianoche CR = 06:00 UTC.
  const CR_OFFSET = 6 * 60 * 60 * 1000;
  const nowCR = new Date(now.getTime() - CR_OFFSET);

  // Cada corte: día/mes de nowCR en "virtual UTC", luego sumamos el offset para obtener medianoche CR real en UTC
  const startOfWeek  = new Date(Date.UTC(nowCR.getUTCFullYear(), nowCR.getUTCMonth(), nowCR.getUTCDate() - 7) + CR_OFFSET);
  const startOfMonth = new Date(Date.UTC(nowCR.getUTCFullYear(), nowCR.getUTCMonth(), 1) + CR_OFFSET);
  const startOfToday = new Date(Date.UTC(nowCR.getUTCFullYear(), nowCR.getUTCMonth(), nowCR.getUTCDate()) + CR_OFFSET);

  const tenantOid = new mongoose.Types.ObjectId(session.tenantId);

  const [topClicks, allTimeClicks, recentOrders, recentSales, monthOrders, monthSales, todaySales, todayOrders] =
    await Promise.all([
      // Top productos por clicks esta semana
      ProductClick.aggregate([
        { $match: { tenantId: tenantOid, timestamp: { $gte: startOfWeek } } },
        { $group: { _id: "$productId", productName: { $first: "$productName" }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } }, { $limit: 10 },
      ]),
      // Total clicks todo el tiempo
      ProductClick.aggregate([
        { $match: { tenantId: tenantOid } },
        { $group: { _id: "$productId", productName: { $first: "$productName" }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } }, { $limit: 10 },
      ]),
      // Últimos pedidos manuales
      Order.find({ tenantId: tenantOid }).sort({ createdAt: -1 }).limit(5).lean(),
      // Últimas ventas POS
      Sale.find({ tenantId: tenantOid }).sort({ saleDate: -1 }).limit(5).lean(),
      // Pedidos del mes
      Order.find({ tenantId: tenantOid, orderedAt: { $gte: startOfMonth } }).lean(),
      // Ventas POS del mes
      Sale.find({ tenantId: tenantOid, saleDate: { $gte: startOfMonth } }).lean(),
      // Ventas POS de hoy
      Sale.find({ tenantId: tenantOid, saleDate: { $gte: startOfToday } }).lean(),
      // Pedidos pagados de hoy
      Order.find({ tenantId: tenantOid, orderedAt: { $gte: startOfToday }, paid: true }).lean(),
    ]);

  // Revenue del mes (pedidos pagados + todas las ventas POS)
  const ordersRevenue = monthOrders.filter((o) => o.paid).reduce((s, o) => s + o.total, 0);
  const salesRevenue  = monthSales.reduce((s, sale) => s + sale.total, 0);
  const totalRevenue  = ordersRevenue + salesRevenue;

  // Ingreso de hoy
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0)
                     + todaySales.reduce((s, sale) => s + sale.total, 0);

  // Actividad reciente: mezcla de pedidos + ventas POS, últimas 5
  const recentActivity = [
    ...recentOrders.map((o) => ({
      id:           String(o._id),
      source:       "manual" as const,
      customerName: o.customerName,
      total:        o.total,
      paid:         o.paid,
      date:         o.orderedAt ?? o.createdAt,
    })),
    ...recentSales.map((s) => ({
      id:           String(s._id),
      source:       "pos" as const,
      customerName: s.customerName || s.cashUserName || "Venta POS",
      total:        s.total,
      paid:         true,
      date:         s.saleDate,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return NextResponse.json({
    topClicksThisWeek: topClicks,
    topClicksAllTime:  allTimeClicks,
    recentActivity,
    monthStats: {
      totalRevenue,
      totalTransactions: monthOrders.length + monthSales.length,
      pendingOrders:     monthOrders.filter((o) => !o.paid).length,
      todayRevenue,
    },
  });
}
