import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { getSession } from "@/lib/auth";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const query: Record<string, unknown> = { tenantId: session.tenantId };
  if (from || to) {
    query.saleDate = {};
    if (from) (query.saleDate as Record<string, unknown>).$gte = new Date(from);
    if (to)   (query.saleDate as Record<string, unknown>).$lte = new Date(to);
  }

  const sales = await Sale.find(query).sort({ saleDate: -1 }).lean();
  return NextResponse.json({ sales });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  const { cashUserId, cashUserName, customerName, tableNumber,
          items, subtotal,
          ivaEnabled, ivaRate, ivaAmount,
          serviceEnabled, serviceRate, serviceAmount,
          tipEnabled, tipAmount,
          total, paymentMethod, mixedPayment } = body;

  if (!items?.length || !paymentMethod) {
    return NextResponse.json({ error: "Faltan campos requeridos (items, paymentMethod)" }, { status: 400 });
  }

  const sale = await Sale.create({
    tenantId:     session.tenantId,
    cashUserId:   cashUserId   ?? "",
    cashUserName: cashUserName ?? "",
    customerName: customerName ?? "",
    tableNumber:  tableNumber  ?? "",
    items,
    subtotal,
    ivaEnabled:     ivaEnabled     ?? false,
    ivaRate:        ivaRate        ?? 13,
    ivaAmount:      ivaAmount      ?? 0,
    serviceEnabled: serviceEnabled ?? false,
    serviceRate:    serviceRate    ?? 10,
    serviceAmount:  serviceAmount  ?? 0,
    tipEnabled:     tipEnabled     ?? false,
    tipAmount:      tipAmount      ?? 0,
    total,
    paymentMethod,
    mixedPayment: mixedPayment ?? { efectivo: 0, sinpe: 0, tarjeta: 0 },
    saleDate: new Date(),
  });

  // Actualizar stock y sold en los productos vendidos (igual que en Orders)
  const bulkOps = items
    .filter((item: { productId: string }) => item.productId)
    .map((item: { productId: string; quantity: number }) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(item.productId), tenantId: session.tenantId },
        update: [
          {
            $set: {
              stock: { $max: [0, { $subtract: ["$stock", item.quantity] }] },
              sold:  { $add: ["$sold", item.quantity] },
            },
          },
        ],
      },
    }));

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps).catch((err) =>
      console.error("[sales POST] Error actualizando stock:", err)
    );
  }

  return NextResponse.json({ sale }, { status: 201 });
}
