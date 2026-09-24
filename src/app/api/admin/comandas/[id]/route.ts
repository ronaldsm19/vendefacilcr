import { NextRequest, NextResponse, after } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda, type IComandaItem } from "@/models/Comanda";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { enqueueComandaPrint, changedStations } from "@/lib/printQueue";
import { withKitchenNotes } from "@/lib/kitchenText";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { snapshotComandaItems, validateComandaItemsInput } from "@/server/services/comandaItems";

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
    version?: unknown; customerName?: unknown; items?: unknown; notes?: unknown;
  };

  try { validateComandaItemsInput(items); }
  catch (err) { return serviceErrorResponse(err); }
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

  let snapshotItems;
  try { snapshotItems = await snapshotComandaItems(session.tenantId, items); }
  catch (err) { return serviceErrorResponse(err); }

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

  // Se comparan con el texto de cocina (extras + nota), así cambiar solo un extra también reimprime.
  const stationsToPrint = changedStations(withKitchenNotes(comanda).items, withKitchenNotes(updated).items);
  after(async () => {
    if (stationsToPrint.length === 0) return; // solo cambiaron datos que no le importan a cocina/bebidas (cliente, notas)
    try { await enqueueComandaPrint(withKitchenNotes(updated), { stations: stationsToPrint }); }
    catch (err) { console.error("[printQueue] comanda editada", err); }
  });

  return NextResponse.json({ comanda: updated });
}
