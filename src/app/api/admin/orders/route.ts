import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { getSession, requireFeature } from "@/lib/auth";
import { normalizeOrderItems } from "@/server/services/orderItems";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

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
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json();
  const { customerName, phone, total, paid, orderedAt, notes } = body;

  if (!customerName || !phone || !body.items?.length || !total) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  const items = normalizeOrderItems(body.items);
  if (!items) {
    return NextResponse.json({ error: "Extras inválidos en algún producto" }, { status: 400 });
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
    options:     ((items[0]?.extras ?? []) as { name: string }[]).map((e) => e.name),
  });

  // Descontar stock e incrementar vendidos por cada item del pedido
  // Los extras no mueven inventario: se descuenta solo la cantidad del producto.
  const stockOps = (items as { productId?: string; quantity: number }[])
    .filter((i) => i.productId)
    .map((i) => ({
      updateOne: {
        filter: {
          _id:      new mongoose.Types.ObjectId(i.productId as string),
          tenantId: new mongoose.Types.ObjectId(session.tenantId),
        },
        // Pipeline de agregación para garantizar que stock no baje de 0
        update: [{
          $set: {
            stock: { $max: [0, { $subtract: ["$stock", i.quantity] }] },
            sold:  { $add: [{ $ifNull: ["$sold", 0] }, i.quantity] },
          },
        }],
      },
    }));

  if (stockOps.length > 0) {
    await Product.bulkWrite(stockOps);
  }

  return NextResponse.json({ order }, { status: 201 });
}
