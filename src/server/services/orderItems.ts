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
