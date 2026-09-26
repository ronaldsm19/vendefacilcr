import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda } from "@/models/Comanda";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { snapshotComandaItems, validateComandaItemsInput } from "@/server/services/comandaItems";

const MAX_ITEMS = 200;

/**
 * Agregar productos a una comanda abierta desde el cobro de la mesa en el POS: lo que la mesa
 * consumió y no se había anotado (una gaseosa, un postre). La cuenta ya se está pagando, así que
 * NO se manda a imprimir a cocina ni a barra, a diferencia de editar la comanda (PUT).
 *
 * Solo agrega al final: los ítems que ya estaban —y lo que ya se cobró de ellos— no se tocan, así
 * que sirve también con una cuenta dividida a medio cobrar. Los precios salen del catálogo, como al
 * crear la comanda. Sube la versión: un cobro o una edición armados con la comanda vieja se rechazan
 * en vez de pisar lo agregado.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pos");
  if (denied) return denied;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const items: unknown = body.items;
  try { validateComandaItemsInput(items); }
  catch (err) { return serviceErrorResponse(err); }

  const comanda = await Comanda.findOne({ _id: id, tenantId: session.tenantId }).select("status items").lean<{
    status: string; items: unknown[];
  } | null>();
  if (!comanda) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (comanda.status !== "enviada" && comanda.status !== "servida") {
    return NextResponse.json({ error: "La comanda ya no está abierta" }, { status: 409 });
  }
  if (comanda.items.length + items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Demasiados ítems en la comanda (máx. ${MAX_ITEMS})` }, { status: 400 });
  }

  let snapshotItems;
  try { snapshotItems = await snapshotComandaItems(session.tenantId, items); }
  catch (err) { return serviceErrorResponse(err); }

  const updated = await Comanda.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId, status: { $in: ["enviada", "servida"] } },
    { $push: { items: { $each: snapshotItems } }, $inc: { version: 1 } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) return NextResponse.json({ error: "La comanda ya no está abierta" }, { status: 409 });

  return NextResponse.json({ comanda: updated });
}
