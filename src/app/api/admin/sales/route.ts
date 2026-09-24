import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { Tenant } from "@/models/Tenant";
import { Comanda, type IComandaItem } from "@/models/Comanda";
import { SalonTable } from "@/models/SalonTable";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { syncTableWithComandas } from "@/lib/tableSync";
import { computeSaleTotals, isOrderType, lineTotal, readPosCharges, subtotalOf } from "@/lib/pricing";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

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

interface ComandaSelectionItemInput {
  index?: unknown;
  qty?: unknown;
}
interface ComandaSelectionInput {
  comandaId?: unknown;
  version?: unknown;
  items?: ComandaSelectionItemInput[];
}

function isPosInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pos");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json();

  // Las tasas, montos de impuesto/servicio, subtotal y total que mande el cliente se ignoran: se
  // recalculan acá con la configuración del negocio (Configuración → Caja) y src/lib/pricing.ts.
  const { customerName, tableNumber,
          items, tipAmount,
          paymentMethod, mixedPayment, notes,
          pickupTime, deliveryAddress, deliveryPhone, deliveryFee,
          tableId, comandaSelections } = body;
  const orderType = isOrderType(body.orderType) ? body.orderType : "LOCAL";

  if (!items?.length || !paymentMethod) {
    return NextResponse.json({ error: "Faltan campos requeridos (items, paymentMethod)" }, { status: 400 });
  }

  interface ItemInput { productId?: unknown; productName?: unknown; unitPrice?: unknown; quantity?: unknown }
  if (!Array.isArray(items) || !(items as ItemInput[]).every((i) =>
    typeof i?.productName === "string" && i.productName.trim() !== "" &&
    typeof i.unitPrice === "number" && Number.isFinite(i.unitPrice) && i.unitPrice >= 0 &&
    Number.isInteger(i.quantity) && (i.quantity as number) >= 1
  )) {
    return NextResponse.json({ error: "Ítems inválidos" }, { status: 400 });
  }
  const saleItems = (items as ItemInput[]).map((i) => {
    const line = {
      productId:   typeof i.productId === "string" ? i.productId : "",
      productName: (i.productName as string).trim(),
      unitPrice:   i.unitPrice as number,
      quantity:    i.quantity as number,
    };
    return { ...line, lineTotal: lineTotal(line) };
  });

  const tenantCfg = await Tenant.findById(session.tenantId).select("posConfig").lean() as { posConfig?: unknown } | null;
  if (!tenantCfg) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  const totals = computeSaleTotals({
    subtotal: subtotalOf(saleItems),
    charges: readPosCharges(tenantCfg.posConfig),
    orderType,
    tipAmount,
    deliveryFee,
  });

  const selections: ComandaSelectionInput[] = Array.isArray(comandaSelections) ? comandaSelections : [];

  if (selections.length > 0) {
    const deniedPlan = await requirePremium(session.tenantId);
    if (deniedPlan) return deniedPlan;

    if (typeof tableId !== "string" || !tableId) {
      return NextResponse.json({ error: "Falta tableId" }, { status: 400 });
    }

    const seenComandaIds = new Set<string>();
    for (const sel of selections) {
      if (
        typeof sel.comandaId !== "string" || !mongoose.Types.ObjectId.isValid(sel.comandaId) ||
        !isPosInt(sel.version) || sel.version < 1 ||
        !Array.isArray(sel.items) || sel.items.length === 0
      ) {
        return NextResponse.json({ error: "comandaSelections inválido" }, { status: 400 });
      }
      if (seenComandaIds.has(sel.comandaId)) {
        return NextResponse.json({ error: `La comanda #${sel.comandaId} aparece dos veces en la selección` }, { status: 400 });
      }
      seenComandaIds.add(sel.comandaId);

      const seenIndexes = new Set<number>();
      for (const it of sel.items) {
        if (!isPosInt(it.index) || !isPosInt(it.qty) || (it.qty as number) < 1) {
          return NextResponse.json({ error: "comandaSelections inválido" }, { status: 400 });
        }
        if (seenIndexes.has(it.index as number)) {
          return NextResponse.json({ error: "Ítem repetido en la comanda" }, { status: 400 });
        }
        seenIndexes.add(it.index as number);
      }
    }
  }

  interface ValidatedSelection {
    comandaId: string;
    version: number;
    number: number;
    items: { index: number; qty: number }[];
  }
  const validated: ValidatedSelection[] = [];

  if (selections.length > 0) {
    const ids = selections.map((s) => s.comandaId as string);
    const comandas = await Comanda.find({ _id: { $in: ids }, tenantId: session.tenantId }).lean();
    const comandaById = new Map(comandas.map((c) => [String(c._id), c]));

    for (const sel of selections) {
      const comandaId = sel.comandaId as string;
      const c = comandaById.get(comandaId);
      if (!c) {
        return NextResponse.json({ error: "Comanda no encontrada", code: "COMANDA_NOT_FOUND" }, { status: 404 });
      }
      if (String(c.tableId) !== tableId) {
        return NextResponse.json({ error: `La comanda #${c.number} no pertenece a la mesa seleccionada`, code: "TABLE_MISMATCH" }, { status: 400 });
      }
      if (c.status !== "enviada" && c.status !== "servida") {
        return NextResponse.json({ error: `La comanda #${c.number} ya no está abierta (${c.status})`, code: "COMANDA_NOT_OPEN" }, { status: 409 });
      }
      if (c.version !== sel.version) {
        return NextResponse.json({ error: `La comanda #${c.number} fue modificada desde el celular. Recargá el panel de mesas.`, code: "VERSION_MISMATCH" }, { status: 409 });
      }
      const selItems = sel.items as ComandaSelectionItemInput[];
      for (const it of selItems) {
        const index = it.index as number;
        const qty = it.qty as number;
        if (index >= c.items.length) {
          return NextResponse.json({ error: `Ítem inexistente en la comanda #${c.number}`, code: "BAD_INDEX" }, { status: 400 });
        }
        const item = c.items[index] as IComandaItem;
        if (qty > item.quantity - item.paidQty) {
          return NextResponse.json({ error: `La comanda #${c.number} tiene menos unidades pendientes de "${item.productName}" que las seleccionadas`, code: "QTY_EXCEEDED" }, { status: 409 });
        }
      }
      validated.push({ comandaId, version: sel.version as number, number: c.number, items: selItems.map((it) => ({ index: it.index as number, qty: it.qty as number })) });
    }
  }

  // Reclamo atómico (uno por comanda, secuencial, sin transacciones)
  const claimed: { id: string; number: number; inc: Record<string, number> }[] = [];
  for (const sel of validated) {
    const inc: Record<string, number> = {};
    for (const it of sel.items) inc[`items.${it.index}.paidQty`] = it.qty;

    const doc = await Comanda.findOneAndUpdate(
      {
        _id: sel.comandaId,
        tenantId: session.tenantId,
        status: { $in: ["enviada", "servida"] },
        version: sel.version,
        $expr: {
          $and: sel.items.map((it) => ({
            $lte: [
              {
                $add: [
                  { $ifNull: [{ $getField: { field: "paidQty", input: { $arrayElemAt: ["$items", it.index] } } }, 0] },
                  it.qty,
                ],
              },
              { $ifNull: [{ $getField: { field: "quantity", input: { $arrayElemAt: ["$items", it.index] } } }, 0] },
            ],
          })),
        },
      },
      { $inc: inc },
      { new: true }
    ).lean();

    if (!doc) {
      for (const c of claimed) {
        const neg = Object.fromEntries(Object.entries(c.inc).map(([k, v]) => [k, -v]));
        await Comanda.updateOne({ _id: c.id, tenantId: session.tenantId }, { $inc: neg });
      }
      return NextResponse.json(
        { error: "Otro cajero acaba de cobrar parte de esta mesa o la comanda cambió. Recargá el panel de mesas.", code: "CONCURRENT_PAYMENT" },
        { status: 409 }
      );
    }
    claimed.push({ id: sel.comandaId, number: sel.number, inc });
  }
  const claimedIds = claimed.map((c) => c.id);

  // Consecutivo de ticket: contador atómico por tenant
  const tenantDoc = await Tenant.findByIdAndUpdate(
    session.tenantId,
    { $inc: { "ticketConfig.ticketNextNumber": 1 } },
    { new: false }
  ).select("ticketConfig.ticketNextNumber").lean() as { ticketConfig?: { ticketNextNumber?: number } } | null;
  const ticketNumber = tenantDoc?.ticketConfig?.ticketNextNumber ?? 1;

  let sale;
  try {
    sale = await Sale.create({
      tenantId:     session.tenantId,
      ticketNumber,
      cashUserId:   session.userId,
      cashUserName: session.name,
      customerName: customerName ?? "",
      tableNumber:  tableNumber  ?? "",
      orderType,
      pickupTime:      pickupTime      ?? "",
      deliveryAddress: deliveryAddress ?? "",
      deliveryPhone:   deliveryPhone   ?? "",
      deliveryFee:     totals.deliveryFee,
      tableId:         typeof tableId === "string" ? tableId : "",
      comandaIds:      claimedIds,
      comandaClaims:   validated.map((v) => ({ comandaId: v.comandaId, items: v.items })),
      items:          saleItems,
      subtotal:       totals.subtotal,
      ivaEnabled:     totals.ivaEnabled,
      ivaRate:        totals.ivaRate,
      ivaAmount:      totals.ivaAmount,
      serviceEnabled: totals.serviceEnabled,
      serviceRate:    totals.serviceRate,
      serviceAmount:  totals.serviceAmount,
      tipEnabled:     totals.tipEnabled,
      tipAmount:      totals.tipAmount,
      total:          totals.total,
      paymentMethod,
      mixedPayment: mixedPayment ?? { efectivo: 0, sinpe: 0, tarjeta: 0 },
      notes: notes ?? "",
      saleDate: new Date(),
    });
  } catch (err) {
    console.error("[sales POST] Error creando la venta:", err);
    for (const c of claimed) {
      const neg = Object.fromEntries(Object.entries(c.inc).map(([k, v]) => [k, -v]));
      await Comanda.updateOne({ _id: c.id, tenantId: session.tenantId }, { $inc: neg });
    }
    return NextResponse.json({ error: "No se pudo registrar la venta" }, { status: 500 });
  }

  // Actualizar stock y sold en los productos vendidos (igual que en Orders)
  const bulkOps = saleItems
    .filter((item) => mongoose.isValidObjectId(item.productId))
    .map((item) => ({
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

  // Cierre de comandas y mesa (un fallo acá no invalida la venta ya creada)
  const comandasOut: { _id: string; number: number; status: string }[] = [];
  let tableResult: { tableId: string; status: string } | null = null;
  let warning: string | undefined;
  if (claimed.length > 0) {
    try {
      const now = new Date();
      const saleId = String(sale._id);
      for (const c of claimed) {
        await Comanda.updateOne({ _id: c.id, tenantId: session.tenantId }, { $addToSet: { saleIds: saleId } });
        const closed = await Comanda.findOneAndUpdate(
          {
            _id: c.id,
            tenantId: session.tenantId,
            status: { $in: ["enviada", "servida"] },
            $expr: {
              $eq: [
                { $sum: { $map: { input: "$items", as: "i", in: { $ifNull: ["$$i.paidQty", 0] } } } },
                { $sum: { $map: { input: "$items", as: "i", in: { $ifNull: ["$$i.quantity", 0] } } } },
              ],
            },
          },
          { $set: { status: "pagada", paidAt: now } },
          { new: true }
        ).lean();
        comandasOut.push({ _id: c.id, number: c.number, status: closed ? "pagada" : "abierta" });
      }
      if (tableId) {
        await syncTableWithComandas(session.tenantId, tableId);
        const t = await SalonTable.findOne({ _id: tableId, tenantId: session.tenantId }).select("status").lean() as { status?: string } | null;
        tableResult = t ? { tableId, status: String(t.status) } : null;
      }
    } catch (err) {
      console.error("[sales POST] Error cerrando comandas/mesa:", err);
      warning = "La venta se registró, pero no se pudo actualizar el estado de las comandas o la mesa.";
    }
  }

  return NextResponse.json({ sale, comandas: comandasOut, table: tableResult, ...(warning ? { warning } : {}) }, { status: 201 });
}
