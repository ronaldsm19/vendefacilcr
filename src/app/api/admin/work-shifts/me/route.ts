import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { getMyHours } from "@/server/services/workShifts";

// Las horas propias de quien tiene la sesión (la app del teléfono). Solo el personal marca
// jornada, así que el admin no entra. El id sale de la sesión, nunca de la URL: nadie puede
// pedir las horas de otra persona.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "cajero", "mesero");
  if (denied) return denied;

  try {
    return NextResponse.json(await getMyHours(session.tenantId, session.userId));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
