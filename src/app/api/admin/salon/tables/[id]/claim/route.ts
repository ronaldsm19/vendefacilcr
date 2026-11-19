import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { SalonTable } from "@/models/SalonTable";
import { LEASE_MS } from "@/lib/cobroLock";

/**
 * POST /api/admin/salon/tables/[id]/claim — toma o renueva el candado de cobro de la mesa.
 * Éxito (200) si la mesa estaba libre, con el lease vencido, o ya es mía (renovación/heartbeat).
 * 409 si la está cobrando otra caja con lease vigente (devuelve su nombre).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;

  // Nombre de la terminal ("Caja N"), opcional, que manda el POS para el aviso "en cobro por … · Caja N".
  let cajaLabel = "";
  try {
    const body = await request.json();
    if (body && typeof body.cajaLabel === "string") cajaLabel = body.cajaLabel.trim().slice(0, 24);
  } catch { /* sin cuerpo: sin etiqueta */ }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LEASE_MS);
  const byName = `${session.name ?? "Caja"}${cajaLabel ? ` · ${cajaLabel}` : ""}`;
  const lock = { by: session.userId, byName, at: now, expiresAt };

  // Atómico: solo toma el candado si está libre, vencido, o ya es mío.
  const updated = await SalonTable.findOneAndUpdate(
    {
      _id: id,
      tenantId: session.tenantId,
      $or: [
        { cobroLock: null },
        { "cobroLock.expiresAt": { $lte: now } },
        { "cobroLock.by": session.userId },
      ],
    },
    { $set: { cobroLock: lock } },
    { new: true }
  ).lean();

  if (updated) {
    return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
  }

  // No se pudo: o no existe la mesa, o la tiene otra caja con lease vigente.
  const current = await SalonTable.findOne({ _id: id, tenantId: session.tenantId })
    .select("cobroLock").lean() as { cobroLock?: { byName?: string } } | null;
  if (!current) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  return NextResponse.json(
    { error: "La mesa la está cobrando otra caja.", code: "TABLE_LOCKED", lockedByName: current.cobroLock?.byName ?? "otra caja" },
    { status: 409 }
  );
}
