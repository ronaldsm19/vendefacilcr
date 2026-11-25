import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { enqueueComandaPrint } from "@/lib/printQueue";
import { withKitchenNotes } from "@/lib/kitchenText";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { snapshotComandaItems, validateComandaItemsInput } from "@/server/services/comandaItems";
import { isOrderType } from "@/lib/pricing";

const STATIONS = ["cocina", "bebidas"] as const;
type Station = (typeof STATIONS)[number];

/**
 * Manda a cocina y a barra un pedido que se toma en el punto de venta sin mesa: de mostrador, para
 * llevar o a domicilio. El cliente pide, cocina empieza, y paga cuando llega o cuando le entregan.
 *
 * No crea una comanda: imprime el tiquete de cada estación con lo que hay en la cuenta. La primera
 * vez toma un número del consecutivo de comandas; si la cuenta cambia y se vuelve a mandar, viaja
 * el mismo número con la versión siguiente y el tiquete sale como "actualizada", igual que una
 * comanda de mesa editada.
 *
 * Body: { items, orderType, customerName?, pickupTime?, notes?, number?, version?, stations? }
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pos");
  if (denied) return denied;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const body = await request.json().catch(() => ({}));
  const items: unknown = body.items;
  try { validateComandaItemsInput(items); }
  catch (err) { return serviceErrorResponse(err); }

  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const customerName = text(body.customerName, 80);
  const notes = text(body.notes, 300);
  const pickupTime = text(body.pickupTime, 20);
  const orderType = isOrderType(body.orderType) ? body.orderType : "LOCAL";

  const validInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) < 1_000_000_000;
  if (body.number !== undefined && !validInt(body.number)) {
    return NextResponse.json({ error: "Número de orden inválido" }, { status: 400 });
  }
  if (body.version !== undefined && !validInt(body.version)) {
    return NextResponse.json({ error: "Versión inválida" }, { status: 400 });
  }
  const stations: Station[] | undefined = Array.isArray(body.stations)
    ? STATIONS.filter((s) => (body.stations as unknown[]).includes(s))
    : undefined;

  let snapshot;
  try { snapshot = await snapshotComandaItems(session.tenantId, items); }
  catch (err) { return serviceErrorResponse(err); }
  const forKitchen = snapshot.filter((i) => i.station === "cocina" || i.station === "bebidas");
  if (forKitchen.length === 0) {
    return NextResponse.json(
      { error: "Estos productos no van a cocina ni a barra (no tienen estación de preparación).", code: "NOTHING_TO_SEND" },
      { status: 400 }
    );
  }

  // Número: el que ya traía la cuenta o el siguiente del consecutivo de comandas.
  let number = body.number as number | undefined;
  if (number === undefined) {
    await Tenant.updateOne(
      { _id: session.tenantId, "comandaConfig.nextNumber": { $exists: false } },
      { $set: { "comandaConfig.nextNumber": 1 } }
    );
    const t = await Tenant.findByIdAndUpdate(
      session.tenantId,
      { $inc: { "comandaConfig.nextNumber": 1 } },
      { new: false }
    ).select("comandaConfig.nextNumber").lean() as { comandaConfig?: { nextNumber?: number } } | null;
    number = t?.comandaConfig?.nextNumber ?? 1;
  }
  const version = (body.version as number | undefined) ?? 1;

  const where = orderType === "PICKUP"
    ? `PARA LLEVAR${pickupTime ? ` ${pickupTime}` : ""}`
    : orderType === "EXPRESS" ? "A DOMICILIO" : "MOSTRADOR";

  let jobs;
  try {
    jobs = await enqueueComandaPrint(withKitchenNotes({
      _id: `pos-${number}`,
      tenantId: session.tenantId,
      number,
      version,
      tableLabel: where,
      areaName: "",
      customerName,
      waiterName: session.name,
      notes,
      items: forKitchen,
    }), stations && stations.length > 0 ? { stations } : {});
  } catch (err) {
    console.error("[printQueue] pedido del punto de venta", err);
    return NextResponse.json({ error: "No se pudo mandar a cocina. Intentá de nuevo." }, { status: 500 });
  }

  return NextResponse.json({
    number,
    version,
    stations: jobs.map((j) => j.station),
    printed: jobs.length,
  });
}
