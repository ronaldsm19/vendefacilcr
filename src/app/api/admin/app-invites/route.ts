import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { createInvite, listInvites } from "@/server/services/appInvites";

// Invitaciones para vincular teléfonos con el negocio en la app del mesero.
// Solo el administrador: quien puede crear empleados es quien puede repartir sus accesos.

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  return NextResponse.json({ invites: await listInvites(session.tenantId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const body = await request.json().catch(() => ({}));

  try {
    const invite = await createInvite({
      tenantId: session.tenantId,
      staffUserId: body.staffUserId,
      days: typeof body.days === "number" ? body.days : undefined,
      createdByName: session.name,
    });
    return NextResponse.json({ invite }, { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
