import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale } from "@/models/Sale";
import { Expense } from "@/models/Expense";
import { Product } from "@/models/Product";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  // Rango del día de hoy (medianoche a medianoche)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [sales, expenses, products] = await Promise.all([
    Sale.find({
      tenantId: session.tenantId,
      saleDate: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ saleDate: -1 }).lean(),

    Expense.find({
      tenantId: session.tenantId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).lean(),

    Product.find({ tenantId: session.tenantId, available: true })
      .select("_id name")
      .lean(),
  ]);

  // Totales de ventas
  const salesTotal = sales.reduce((s, sale) => s + (sale.total ?? 0), 0);

  // Desglose por método de pago (los pagos mixtos se reparten por porción)
  const paymentBreakdown = { efectivo: 0, sinpe: 0, tarjeta: 0 };
  for (const sale of sales) {
    if (sale.paymentMethod === "mixto" && sale.mixedPayment) {
      const mp = sale.mixedPayment as { efectivo?: number; sinpe?: number; tarjeta?: number };
      paymentBreakdown.efectivo += mp.efectivo ?? 0;
      paymentBreakdown.sinpe    += mp.sinpe    ?? 0;
      paymentBreakdown.tarjeta  += mp.tarjeta  ?? 0;
    } else {
      const method = sale.paymentMethod as "efectivo" | "sinpe" | "tarjeta";
      if (method in paymentBreakdown) paymentBreakdown[method] += sale.total ?? 0;
    }
  }

  // Gastos del día
  const expensesTotal = expenses.reduce((s, e) => s + (e.total ?? 0), 0);

  // Productos vendidos hoy
  const soldMap: Record<string, { productId: string; productName: string; unitsSold: number }> = {};
  for (const sale of sales) {
    for (const item of (sale.items ?? [])) {
      const id = String(item.productId);
      if (!soldMap[id]) {
        soldMap[id] = { productId: id, productName: item.productName, unitsSold: 0 };
      }
      soldMap[id].unitsSold += item.quantity;
    }
  }

  // Productos con 0 ventas hoy
  const soldIds = new Set(Object.keys(soldMap));
  const notSold = products
    .filter((p) => !soldIds.has(String(p._id)))
    .map((p) => ({ productId: String(p._id), productName: p.name as string, unitsSold: 0 }));

  const productsSummary = [...Object.values(soldMap).sort((a, b) => b.unitsSold - a.unitsSold), ...notSold];

  return NextResponse.json({
    sales,
    salesTotal,
    paymentBreakdown,
    expensesTotal,
    profit: salesTotal - expensesTotal,
    productsSummary,
    date: startOfDay.toISOString(),
  });
}
