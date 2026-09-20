import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda, type IComandaItem } from "@/models/Comanda";
import { Product } from "@/models/Product";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { effectiveStation } from "@/lib/station";
import { enqueueComandaPrint } from "@/lib/printQueue";

interface ItemInput {
  productId?: unknown;
  quantity?: unknown;
  note?: unknown;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const comanda = await Comanda.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!comanda) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isOpen = comanda.status === "enviada" || comanda.status === "servida";
  if (session.role === "mesero" && !isOpen && comanda.waiterId !== session.userId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ comanda });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await request.json();
  const { version, customerName, items, notes } = body as {
    version?: unknown; customerName?: unknown; items?: ItemInput[]; notes?: unknown;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Agregá al menos un producto" }, { status: 400 });
  }
  if (items.length > 200) {
    return NextResponse.json({ error: "Demasiados ítems (máx. 200)" }, { status: 400 });
  }
  for (const item of items) {
    if (typeof item.productId !== "string" || !mongoose.isValidObjectId(item.productId)) {
      return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
    }
    if (!Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 99) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    if (item.note !== undefined && (typeof item.note !== "string" || item.note.length > 200)) {
      return NextResponse.json({ error: "La nota del ítem es muy larga (máx. 200)" }, { status: 400 });
    }
  }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 500)) {
    return NextResponse.json({ error: "Las notas son muy largas (máx. 500)" }, { status: 400 });
  }
  if (customerName !== undefined && (typeof customerName !== "string" || customerName.length > 80)) {
    return NextResponse.json({ error: "El nombre del cliente es muy largo" }, { status: 400 });
  }

  const comanda = await Comanda.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!comanda) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (comanda.status !== "enviada" && comanda.status !== "servida") {
    return NextResponse.json({ error: "La comanda ya no está abierta" }, { status: 409 });
  }
  if (comanda.items.some((i: IComandaItem) => i.paidQty > 0)) {
    return NextResponse.json({ error: "La comanda tiene ítems cobrados y no se puede editar" }, { status: 409 });
  }
  if (version === undefined) {
    return NextResponse.json({ error: "version requerida" }, { status: 400 });
  }

  const ids = items.map((i) => String(i.productId));
  const products = await Product.find({ _id: { $in: ids }, tenantId: session.tenantId }).lean() as Array<Record<string, unknown>>;
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  if (products.length !== new Set(ids).size) {
    return NextResponse.json({ error: "Un producto ya no existe" }, { status: 400 });
  }
  for (const p of products) {
    if (p.available === false) {
      return NextResponse.json({ error: `"${p.name}" no está disponible` }, { status: 400 });
    }
  }

  const snapshotItems = items.map((i) => {
    const p = productMap.get(String(i.productId))!;
    return {
      productId: String(i.productId),
      productName: p.name as string,
      unitPrice: p.price as number,
      quantity: i.quantity as number,
      station: effectiveStation(p as { station?: string; menuSection?: string }),
      note: typeof i.note === "string" ? i.note.trim() : "",
      paidQty: 0,
    };
  });

  const $set: Record<string, unknown> = { items: snapshotItems };
  if (customerName !== undefined) $set.customerName = customerName.trim();
  if (notes !== undefined) $set.notes = notes.trim();

  const updated = await Comanda.findOneAndUpdate(
    {
      _id: id,
      tenantId: session.tenantId,
      version,
      status: { $in: ["enviada", "servida"] },
      "items.paidQty": { $not: { $gt: 0 } },
    },
    { $set, $inc: { version: 1 } },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: "La comanda fue modificada por otra persona. Recargá e intentá de nuevo." }, { status: 409 });
  }

  try {
    await enqueueComandaPrint(updated);
  } catch (err) {
    console.error("[PUT /api/admin/comandas/[id]] enqueueComandaPrint failed:", err);
  }

  return NextResponse.json({ comanda: updated });
}
