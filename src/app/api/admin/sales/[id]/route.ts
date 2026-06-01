import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale } from "@/models/Sale";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const sale = await Sale.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!sale) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ sale });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  const {
    customerName, tableNumber, cashUserId, cashUserName,
    items, paymentMethod, mixedPayment,
    ivaEnabled, ivaRate, serviceEnabled, serviceRate, tipEnabled, tipAmount,
  } = body;

  if (!items?.length) {
    return NextResponse.json({ error: "La venta debe tener al menos un producto" }, { status: 400 });
  }

  const subtotal = items.reduce(
    (s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity,
    0
  );
  const ivaAmount     = (ivaEnabled     && ivaRate)     ? Math.round(subtotal * ivaRate     / 100) : 0;
  const serviceAmount = (serviceEnabled && serviceRate)  ? Math.round(subtotal * serviceRate / 100) : 0;
  const tipAmt        = tipEnabled ? (tipAmount ?? 0) : 0;
  const total         = subtotal + ivaAmount + serviceAmount + tipAmt;

  const sale = await Sale.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    {
      $set: {
        customerName:  customerName  ?? "",
        tableNumber:   tableNumber   ?? "",
        cashUserId:    cashUserId    ?? "",
        cashUserName:  cashUserName  ?? "",
        items:         items.map((i: { productId: string; productName: string; unitPrice: number; quantity: number }) => ({
          ...i,
          lineTotal: i.unitPrice * i.quantity,
        })),
        paymentMethod,
        mixedPayment:  mixedPayment  ?? { efectivo: 0, sinpe: 0, tarjeta: 0 },
        ivaEnabled:    ivaEnabled    ?? false,
        ivaRate:       ivaRate       ?? 13,
        ivaAmount,
        serviceEnabled: serviceEnabled ?? false,
        serviceRate:   serviceRate   ?? 10,
        serviceAmount,
        tipEnabled:    tipEnabled    ?? false,
        tipAmount:     tipAmt,
        subtotal,
        total,
      },
    },
    { new: true }
  ).lean();

  if (!sale) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ sale });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  await Sale.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
