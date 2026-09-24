import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { getSession, requireFeature } from "@/lib/auth";
import { computeSaleTotals, isOrderType, normalizeExtras, subtotalOf } from "@/lib/pricing";
import { checkCatalogPrices, parseSaleItems, saleLineKey, type SaleItemRecord } from "@/server/services/saleItems";
import { serviceErrorResponse } from "@/lib/serviceResponse";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

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
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  const {
    customerName, tableNumber,
    items, paymentMethod, mixedPayment,
    notes,
  } = body;

  if (!items?.length) {
    return NextResponse.json({ error: "La venta debe tener al menos un producto" }, { status: 400 });
  }

  const parsedItems = parseSaleItems(items);
  if (!parsedItems) {
    return NextResponse.json({ error: "Ítems inválidos" }, { status: 400 });
  }

  // Tasas, tipo de pedido, envío y propina salen de la venta guardada: editar corrige productos,
  // cliente o pago, pero no cambia los cobros con los que se hizo la venta (ni se pueden cambiar
  // mandándolos en el cuerpo).
  const existing = await Sale.findOne({ _id: id, tenantId: session.tenantId })
    .select("items orderType ivaEnabled ivaRate serviceEnabled serviceRate tipEnabled tipAmount deliveryFee")
    .lean() as {
      items?: { productId: string; unitPrice: number; quantity: number; extras?: unknown }[];
      orderType?: string;
      ivaEnabled?: boolean; ivaRate?: number;
      serviceEnabled?: boolean; serviceRate?: number;
      tipEnabled?: boolean; tipAmount?: number;
      deliveryFee?: number;
    } | null;
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Precios: las líneas que la venta ya tenía (mismo producto, precio y extras) se quedan con lo que
  // se cobró en su momento, aunque cambie la cantidad; lo que se agregue nuevo va al precio actual
  // del catálogo. Así no se puede reescribir un precio desde el cuerpo de la petición.
  const keep = new Set((existing.items ?? []).map((i) =>
    saleLineKey({ productId: i.productId ?? "", unitPrice: i.unitPrice, extras: normalizeExtras(i.extras) ?? [] })
  ));
  let saleItems: SaleItemRecord[];
  try {
    saleItems = await checkCatalogPrices(session.tenantId, parsedItems, keep);
  } catch (err) {
    return serviceErrorResponse(err);
  }

  const totals = computeSaleTotals({
    subtotal: subtotalOf(saleItems),
    charges: {
      ivaEnabled:     existing.ivaEnabled ?? false,
      ivaRate:        existing.ivaRate ?? 13,
      serviceEnabled: existing.serviceEnabled ?? false,
      serviceRate:    existing.serviceRate ?? 10,
      tipEnabled:     existing.tipEnabled ?? false,
    },
    orderType: isOrderType(existing.orderType) ? existing.orderType : "LOCAL",
    tipAmount: existing.tipAmount,
    deliveryFee: existing.deliveryFee,
  });

  const sale = await Sale.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    {
      $set: {
        customerName:  customerName  ?? "",
        tableNumber:   tableNumber   ?? "",
        items:         saleItems,
        paymentMethod,
        mixedPayment:  mixedPayment  ?? { efectivo: 0, sinpe: 0, tarjeta: 0 },
        ivaAmount:     totals.ivaAmount,
        serviceAmount: totals.serviceAmount,
        tipAmount:     totals.tipAmount,
        notes:         notes         ?? "",
        subtotal:      totals.subtotal,
        total:         totals.total,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!sale) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Ajustar stock/sold por la diferencia entre los items anteriores y los nuevos
  // (mismo patrón de bulkWrite que POST /api/admin/sales, stock nunca bajo cero).
  try {
    const diffByProduct = new Map<string, number>();
    for (const i of existing.items ?? []) {
      if (!i.productId) continue;
      diffByProduct.set(i.productId, (diffByProduct.get(i.productId) ?? 0) - i.quantity);
    }
    for (const i of saleItems) {
      if (!i.productId) continue;
      diffByProduct.set(i.productId, (diffByProduct.get(i.productId) ?? 0) + i.quantity);
    }

    const bulkOps = Array.from(diffByProduct.entries())
      .filter(([, diff]) => diff !== 0)
      .map(([productId, diff]) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(productId), tenantId: session.tenantId },
          update: [
            {
              $set: {
                stock: { $max: [0, { $subtract: ["$stock", diff] }] },
                sold:  { $max: [0, { $add: ["$sold", diff] }] },
              },
            },
          ],
        },
      }));

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }
  } catch (err) {
    console.error("[sales PUT] Error actualizando stock:", err);
  }

  return NextResponse.json({ sale });
}
