import { NextRequest, NextResponse } from "next/server";
import { getSession, requireFeature } from "@/lib/auth";
import { isDesktopRequest } from "@/lib/device";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { stopShift } from "@/server/services/workShifts";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "jornada");
  if (denied) return denied;

  if (!isDesktopRequest(request)) {
    return NextResponse.json(
      { error: "El marcaje de jornada solo se puede hacer desde la computadora del negocio" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const staffUserId = typeof body.staffUserId === "string" ? body.staffUserId : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!staffUserId || !pin) {
    return NextResponse.json({ error: "Falta la persona o el PIN" }, { status: 400 });
  }

  try {
    const shift = await stopShift(session.tenantId, staffUserId, pin);
    return NextResponse.json({ shift });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
