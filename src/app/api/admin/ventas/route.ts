import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Sale } from "@/models/Sale";
import { getSession } from "@/lib/auth";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  const now   = new Date();
  const from  = fromParam ? new Date(fromParam) : startOfDay(now);
  const to    = toParam   ? new Date(toParam)   : endOfDay(now);

  await connectToDatabase();

  const [orders, sales] = await Promise.all([
    Order.find({
      tenantId: session.tenantId,
      orderedAt: { $gte: from, $lte: to },
    }).lean(),
    Sale.find({
      tenantId: session.tenantId,
      saleDate: { $gte: from, $lte: to },
    }).lean(),
  ]);

  const METHOD_LABELS: Record<string, string> = {
    efectivo: "Efectivo",
    sinpe:    "SINPE",
    tarjeta:  "Tarjeta",
    mixto:    "Mixto",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = [
    ...orders.map((o: any) => ({
      id:            String(o._id),
      source:        "manual" as const,
      date:          (o.orderedAt ?? o.createdAt).toISOString(),
      customerName:  o.customerName ?? "",
      total:         o.total ?? 0,
      paid:          o.paid ?? false,
      phone:         o.phone ?? "",
      notes:         o.notes ?? "",
      itemCount:     o.items?.length ?? (o.productId ? 1 : 0),
    })),
    ...sales.map((s: any) => ({
      id:            String(s._id),
      source:        "pos" as const,
      date:          (s.saleDate ?? s.createdAt).toISOString(),
      customerName:  s.customerName ?? "Venta POS",
      total:         s.total ?? 0,
      paid:          true,
      paymentMethod: METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod,
      cashierName:   s.cashUserName ?? "",
      itemCount:     s.items?.length ?? 0,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const pagado    = items.filter((i) => i.paid).reduce((s, i) => s + i.total, 0);
  const porCobrar = items.filter((i) => !i.paid).reduce((s, i) => s + i.total, 0);
  const total     = items.reduce((s, i) => s + i.total, 0);

  return NextResponse.json({ items, stats: { pagado, porCobrar, total } });
}
