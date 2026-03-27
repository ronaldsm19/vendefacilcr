import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ProductClick } from "@/models/ProductClick";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const tenantOid = new mongoose.Types.ObjectId(session.tenantId);

  // Top productos por clicks (esta semana)
  const topClicks = await ProductClick.aggregate([
    { $match: { tenantId: tenantOid, timestamp: { $gte: startOfWeek } } },
    { $group: { _id: "$productId", productName: { $first: "$productName" }, clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    { $limit: 10 },
  ]);

  // Total clicks por producto (todo el tiempo)
  const allTimeClicks = await ProductClick.aggregate([
    { $match: { tenantId: tenantOid } },
    { $group: { _id: "$productId", productName: { $first: "$productName" }, clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    { $limit: 10 },
  ]);

  // Últimos 5 pedidos
  const recentOrders = await Order.find({ tenantId: tenantOid })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  // Stats del mes
  const monthOrders = await Order.find({ tenantId: tenantOid, orderedAt: { $gte: startOfMonth } }).lean();
  const totalRevenue = monthOrders
    .filter((o) => o.paid)
    .reduce((sum, o) => sum + o.total, 0);
  const pendingCount = monthOrders.filter((o) => !o.paid).length;

  return NextResponse.json({
    topClicksThisWeek: topClicks,
    topClicksAllTime: allTimeClicks,
    recentOrders,
    monthStats: {
      totalRevenue,
      totalOrders: monthOrders.length,
      pendingOrders: pendingCount,
    },
  });
}
