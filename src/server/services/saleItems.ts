import { lineTotal, normalizeExtras, type LineExtra } from "@/lib/pricing";

export interface SaleItemRecord {
  productId: string;
  productName: string;
  unitPrice: number;      // precio base
  quantity: number;
  extras: LineExtra[];
  lineTotal: number;      // (base + extras) × cantidad, calculado acá con src/lib/pricing.ts
}

/**
 * Valida los ítems de una venta (crear o editar) y calcula el total de cada línea con el helper
 * compartido; el lineTotal que mande el cliente se ignora. Devuelve null si algún ítem no es válido.
 */
export function parseSaleItems(raw: unknown): SaleItemRecord[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: SaleItemRecord[] = [];
  for (const i of raw as Record<string, unknown>[]) {
    if (typeof i?.productName !== "string" || i.productName.trim() === "") return null;
    if (typeof i.unitPrice !== "number" || !Number.isFinite(i.unitPrice) || i.unitPrice < 0) return null;
    if (!Number.isInteger(i.quantity) || (i.quantity as number) < 1) return null;
    const extras = normalizeExtras(i.extras);
    if (!extras) return null;
    const line = {
      productId:   typeof i.productId === "string" ? i.productId : "",
      productName: i.productName.trim(),
      unitPrice:   i.unitPrice,
      quantity:    i.quantity as number,
      extras,
    };
    out.push({ ...line, lineTotal: lineTotal(line) });
  }
  return out;
}
