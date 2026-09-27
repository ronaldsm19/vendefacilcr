import { normalizeExtras, type LineExtra } from "@/lib/pricing";

/**
 * Normaliza los extras de cada ítem de un pedido manual (copia congelada {name, price}). Devuelve
 * null si alguno trae extras inválidos. El resto del ítem se deja como viene: el total del pedido
 * lo puede ajustar el admin a mano desde el formulario.
 */
export function normalizeOrderItems(raw: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Record<string, unknown>[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    if (!item || typeof item !== "object") return null;
    const extras: LineExtra[] | null = normalizeExtras(item.extras);
    if (!extras) return null;
    out.push({ ...item, extras });
  }
  return out;
}

/**
 * Fecha y hora del pedido manual. El formulario manda un instante ISO con zona (ej.
 * "2026-09-26T02:00:00.000Z" para las 8:00 p. m. del 25 en Costa Rica), así que `new Date` da el
 * mismo instante sin importar la zona del servidor. undefined si no viene (el POST usa "ahora" y el
 * PATCH conserva la que tenía); "invalid" si no es una fecha, para responder 400 en vez de 500.
 */
export function parseOrderedAt(raw: unknown): Date | undefined | "invalid" {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return "invalid";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}
