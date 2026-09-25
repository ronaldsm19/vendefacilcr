import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { listDevices, revokeAllForUser } from "@/server/services/refreshTokens";

// Dispositivos con sesión viva de una persona del personal. Sirve para el caso concreto de un
// teléfono perdido o robado: el dueño entra y corta el acceso sin tener que cambiar el PIN.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  const devices = await listDevices(session.tenantId, id);
  return NextResponse.json({ devices });
}

/** Revoca TODAS las sesiones de esa persona. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  const revoked = await revokeAllForUser(session.tenantId, id);
  return NextResponse.json({ ok: true, revoked });
}
