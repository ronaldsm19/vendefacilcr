import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { markShiftByQr } from "@/server/services/workShifts";

// Marcar la entrada o la salida desde el teléfono, con el código que muestra la computadora del
// negocio. Al revés que start y stop, acá NO se exige una computadora: el que llama es el
// teléfono. Lo que ata el marcaje al local es el código, que cambia cada medio minuto.
// Quién marca sale de la sesión, nunca del cuerpo: nadie puede marcar por otra persona. Solo el
// personal marca jornada, así que el admin no entra.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "jornada");
  if (deniedPlan) return deniedPlan;
  const denied = requireRole(session, "cajero", "mesero");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  const action = body.action;
  if (!code) return NextResponse.json({ error: "Falta el código" }, { status: 400 });
  if (action !== "entrada" && action !== "salida") {
    return NextResponse.json({ error: "Falta decir si es entrada o salida" }, { status: 400 });
  }

  try {
    const shift = await markShiftByQr(session.tenantId, session.userId, code, action);
    return NextResponse.json({ action, shift }, { status: action === "entrada" ? 201 : 200 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
