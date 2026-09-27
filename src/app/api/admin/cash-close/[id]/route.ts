import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashClose } from "@/models/CashClose";
import { CashSession } from "@/models/CashSession";
import { getSession, requireFeature, requireRole } from "@/lib/auth";
import mongoose from "mongoose";

/** Edita un cierre ya hecho. Solo el admin: el cajero corrige la apertura mientras la caja está abierta. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "cierre-de-caja") ?? requireRole(session, "admin");
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  await connectToDatabase();
  const body = await request.json();
  const { arqueo, cashLeft, notes } = body;

  const existing = await CashClose.findOne({ _id: id, tenantId: session.tenantId })
    .lean() as { cashLeft?: number } | null;
  if (!existing) return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (arqueo !== undefined) update.arqueo = arqueo;
  if (cashLeft !== undefined) update.cashLeft = Math.max(0, Number(cashLeft) || 0);
  if (notes !== undefined) update.notes = String(notes);

  // Lo que quedó en caja es la caja inicial de la próxima apertura, que la lee de la sesión de este
  // cierre. Si ya se volvió a abrir la caja, ese monto ya se usó y cambiarlo acá no la corrige.
  const cashLeftChanged = update.cashLeft !== undefined && update.cashLeft !== (existing.cashLeft ?? 0);
  const closedSession = cashLeftChanged
    ? await CashSession.findOne({ tenantId: session.tenantId, closeId: id })
        .lean() as { _id: unknown; openedAt: Date } | null
    : null;
  if (closedSession) {
    const reopened = await CashSession.exists({
      tenantId: session.tenantId,
      _id: { $ne: closedSession._id },
      openedAt: { $gt: closedSession.openedAt },
    });
    if (reopened) {
      return NextResponse.json(
        { error: "Después de este cierre ya se volvió a abrir la caja; lo que quedó en caja ya no se puede cambiar." },
        { status: 409 }
      );
    }
  }

  const updated = await CashClose.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!updated) return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });

  if (closedSession) {
    await CashSession.updateOne({ _id: closedSession._id }, { $set: { cashLeft: update.cashLeft } });
  }

  return NextResponse.json({ cashClose: updated });
}
