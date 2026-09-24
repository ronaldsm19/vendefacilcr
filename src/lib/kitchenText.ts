import type { LineExtra } from "@/lib/pricing";

interface KitchenLine {
  quantity: number;
  note?: string;
  extras?: LineExtra[];
}

/**
 * Texto que ve cocina o bebidas debajo de un producto: los extras con su cantidad (nunca el precio)
 * y después la nota del mesero. Ej.: "+ Queso extra x2, + Tocineta x2 — sin cebolla".
 *
 * Viaja en el campo `nota` del ítem del ticket de comanda, así el contrato con el agente de
 * impresión ({ cantidad, nombre, nota }) no cambia.
 */
export function kitchenNote(line: KitchenLine): string {
  const extras = (line.extras ?? []).map((e) => `+ ${e.name} x${line.quantity}`).join(", ");
  const note = (line.note ?? "").trim();
  return [extras, note].filter(Boolean).join(" — ");
}

/**
 * La misma comanda con la nota de cada ítem reemplazada por el texto para cocina (extras + nota).
 * Se le pasa a la cola de impresión y a la comparación de versiones al editar, para que cambiar
 * solo los extras de una línea también reimprima el ticket de esa estación.
 */
export function withKitchenNotes<T extends { items: KitchenLine[] }>(c: T): T {
  return { ...c, items: c.items.map((i) => ({ ...i, note: kitchenNote(i) })) };
}
