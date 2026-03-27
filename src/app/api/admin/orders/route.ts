import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const paid = searchParams.get("paid");

  const query: Record<string, unknown> = { tenantId: session.tenantId };
  if (paid !== null) query.paid = paid === "true";
  const orders = await Order.find(query).sort({ orderedAt: -1 }).lean();
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const { customerName, phone, items, total, paid, orderedAt, notes } = body;

  if (!customerName || !phone || !items?.length || !total) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const order = await Order.create({
    tenantId: session.tenantId,
    customerName,
    phone,
    items,
    total:     Number(total),
    paid:      paid ?? false,
    orderedAt: orderedAt ? new Date(orderedAt) : new Date(),
    notes,
    // Legacy fields from first item for backward compat display
    productId:   items[0]?.productId   ?? "",
    productName: items[0]?.productName ?? "",
    quantity:    items[0]?.quantity    ?? 1,
    options:     items[0]?.itemToppings?.flat() ?? [],
  });

  return NextResponse.json({ order }, { status: 201 });
}
