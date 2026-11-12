import { NextRequest, NextResponse } from "next/server";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { isDesktopRequest } from "@/lib/device";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { getShiftQr } from "@/server/services/workShifts";

// El código que la computadora del negocio pone en pantalla para marcar jornada desde el
// teléfono. Tiene las mismas condiciones que marcar con el PIN: una sesión del panel con acceso
// a Jornada, y desde una computadora. El código vale por estar frente a esa pantalla, así que
// no se le entrega a un teléfono. Es el mismo impedimento práctico que describe lib/device, no
// una garantía: quien pueda marcar con su PIN desde otro equipo también puede pedir este código.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "jornada");
  if (deniedPlan) return deniedPlan;
  const denied = requireFeature(session, "jornada");
  if (denied) return denied;

  if (!isDesktopRequest(request)) {
    return NextResponse.json(
      { error: "El código para marcar jornada solo se muestra en la computadora del negocio" },
      { status: 403 }
    );
  }

  try {
    return NextResponse.json(await getShiftQr(session.tenantId));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
