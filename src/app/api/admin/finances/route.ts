import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Expense } from "@/models/Expense";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "month"; // week | month | year

  const now = new Date();
  let startDate: Date;
  let groupFormat: string;

  if (period === "week") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 28); // últimas 4 semanas
    groupFormat = "%Y-%U"; // año-semana
  } else if (period === "year") {
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    groupFormat = "%Y-%m";
  } else {
    // month (últimos 12 meses)
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    groupFormat = "%Y-%m";
  }

  const tenantOid = new mongoose.Types.ObjectId(session.tenantId);

  // Ingresos agrupados
  const revenueByPeriod = await Order.aggregate([
    { $match: { tenantId: tenantOid, paid: true, orderedAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$orderedAt" } },
        revenue: { $sum: "$total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Gastos agrupados
  const expensesByPeriod = await Expense.aggregate([
    { $match: { tenantId: tenantOid, date: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$date" } },
        expenses: { $sum: "$total" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Ingresos por producto
  const revenueByProduct = await Order.aggregate([
    { $match: { tenantId: tenantOid, paid: true, orderedAt: { $gte: startDate } } },
    {
      $group: {
        _id: "$productName",
        revenue: { $sum: "$total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
  ]);

  // Gastos por categoría
  const expensesByCategory = await Expense.aggregate([
    { $match: { tenantId: tenantOid, date: { $gte: startDate } } },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  // Totales globales del período
  const [totalRevenue, totalExpenses] = await Promise.all([
    Order.aggregate([
      { $match: { tenantId: tenantOid, paid: true, orderedAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { tenantId: tenantOid, date: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  const revenue = totalRevenue[0]?.total ?? 0;
  const expenses = totalExpenses[0]?.total ?? 0;

  return NextResponse.json({
    summary: {
      revenue,
      expenses,
      profit: revenue - expenses,
      margin: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0,
      totalOrders: totalRevenue[0]?.count ?? 0,
    },
    revenueByPeriod,
    expensesByPeriod,
    revenueByProduct,
    expensesByCategory,
  });
}
