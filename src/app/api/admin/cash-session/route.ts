import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashSession } from "@/models/CashSession";
import { MAX_OPENING_CORRECTION_NOTE } from "@/models/CashOpeningCorrection";
import { getSession, requireFeature } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "cierre-de-caja");
  if (denied) return denied;

  await connectToDatabase();

  const open = await CashSession.findOne({ tenantId: session.tenantId, status: "open" }).lean();

  let previousCashLeft: number | null = null;
  if (!open) {
    const last = await CashSession.findOne({ tenantId: session.tenantId, status: "closed" })
      .sort({ closedAt: -1 })
      .lean() as { cashLeft?: number } | null;
    previousCashLeft = last ? (last.cashLeft ?? 0) : null;
  }

  return NextResponse.json({ open, previousCashLeft });
}

/**
 * Corrige lo que se digitó al abrir la caja, solo mientras sigue abierta (un cierre ya hecho lo
 * corrige el admin desde el cierre). Lo digitado es la caja inicial en la primera apertura del
 * negocio, y el conteo en las demás: ahí la caja inicial es lo que quedó en el cierre anterior y no
 * se toca. Cada corrección queda anotada con el monto anterior y quién la hizo.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "cierre-de-caja");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const amount = body?.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, MAX_OPENING_CORRECTION_NOTE) : "";

  await connectToDatabase();

  const open = await CashSession.findOne({ tenantId: session.tenantId, status: "open" }).lean() as {
    _id: unknown;
    openingAmount: number;
    previousCashLeft?: number | null;
    countedAmount?: number | null;
  } | null;
  if (!open) {
    return NextResponse.json({ error: "No hay una caja abierta" }, { status: 404 });
  }

  const field = open.previousCashLeft == null ? "openingAmount" : "countedAmount";
  const previousAmount = open[field] ?? undefined;
  if (previousAmount === amount) {
    return NextResponse.json({ error: "Es el mismo monto que ya tiene la caja" }, { status: 400 });
  }

  const set: Record<string, number> = { [field]: amount };
  if (field === "countedAmount") set.openingDifference = amount - open.openingAmount;
  else if (open.countedAmount != null) set.openingDifference = open.countedAmount - amount;

  // El filtro exige el monto que se leyó: si otro equipo corrigió o cerró la caja en el medio,
  // no se pisa su cambio y la anotación de "monto anterior" sigue siendo cierta.
  const updated = await CashSession.findOneAndUpdate(
    { _id: open._id, status: "open", [field]: previousAmount ?? null },
    {
      $set: set,
      $push: {
        openingCorrections: {
          field,
          previousAmount,
          newAmount: amount,
          byName: session.name,
          byRole: session.role,
          note,
          date: new Date(),
        },
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!updated) {
    return NextResponse.json(
      { error: "La caja cambió mientras corregías. Actualizá la pantalla e intentá de nuevo." },
      { status: 409 }
    );
  }

  return NextResponse.json({ session: updated });
}
