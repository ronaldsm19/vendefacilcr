import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { revokeDevice } from "@/server/services/refreshTokens";

/** Revoca UN dispositivo. El filtro por tenant vive en el servicio: nadie corta sesiones ajenas. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { deviceId } = await params;
  const ok = await revokeDevice(session.tenantId, deviceId);
  if (!ok) return NextResponse.json({ error: "Dispositivo no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
