import { NextRequest, NextResponse } from "next/server";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { consumeAttempt } from "@/server/services/rateLimit";
import { resolveInvite } from "@/server/services/appInvites";

/**
 * Canje del código de invitación de la app. ÚNICA ruta pública de este conjunto: el teléfono
 * todavía no tiene sesión cuando escanea, así que no puede haber token acá.
 *
 * No entrega credenciales ni sesión — solo dice a qué restaurante apunta el código, para que la
 * app se pinte con sus colores y sepa contra qué negocio validar. El mesero igual tiene que
 * entrar después con su usuario y su PIN.
 *
 * Límite por IP porque el código es corto: sin él, se podrían probar códigos al azar hasta dar
 * con uno. Aun acertando, lo único que se obtiene es el nombre del restaurante, que ya es
 * público; el límite está para que nadie use esto como barredora.
 */

const MAX_ATTEMPTS = 20;
const WINDOW_MS = 10 * 60 * 1000;

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const allowed = await consumeAttempt(`invite-ip:${getIp(request)}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá unos minutos." },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const resolved = await resolveInvite(code);
    return NextResponse.json(resolved, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
