import type { NextRequest } from "next/server";

const MOBILE_UA_RE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i;

/**
 * Heurística por User-Agent para detectar un equipo de escritorio. Es un impedimento
 * práctico para el marcaje de jornada, NO una garantía de seguridad: un teléfono al que
 * se le pide la "versión de escritorio" del navegador cambia su User-Agent y pasa este
 * chequeo sin problema. Cerrar esto de verdad requeriría restringir por IP del local
 * (fuera del alcance de este módulo). Sin User-Agent (scripts, herramientas internas) se
 * deja pasar: no hay forma de distinguirlo de un escritorio legítimo con ese dato.
 */
export function isDesktopRequest(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua) return true;
  return !MOBILE_UA_RE.test(ua);
}
