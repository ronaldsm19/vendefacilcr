/**
 * Cómo se cobra un producto: a precio fijo (un burrito, un café) o por kilo (un queso madurado
 * que se corta y se pesa). En los de kilo, `price` y `cost` son por kilo.
 */
export const SOLD_BY = ["unidad", "kg"] as const;
export type SoldBy = (typeof SOLD_BY)[number];

export function isSoldBy(v: unknown): v is SoldBy {
  return SOLD_BY.includes(v as SoldBy);
}

/** Lo que va después del precio al mostrarlo: "/kg" en los de kilo, nada en los de precio fijo. */
export function priceSuffix(soldBy: SoldBy | undefined): string {
  return soldBy === "kg" ? "/kg" : "";
}

/** Precio de una pieza pesada, en colones enteros. */
export function priceForWeight(pricePerKg: number, kg: number): number {
  return Math.round(pricePerKg * kg);
}

/** Lee un peso escrito a mano ("0,350" o "0.350"); null si no es un peso válido. */
export function parseKg(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const kg = Number(t);
  return kg > 0 && kg < 1000 ? kg : null;
}

/** Peso para mostrar e imprimir: 0,350 kg. */
export function formatKg(kg: number): string {
  return `${kg.toLocaleString("es-CR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}

/** Peso máximo de una pieza: más que esto es un error de digitación o de la báscula. */
export const MAX_WEIGHT_KG = 999.999;

/**
 * Valida el peso de una línea que llega de afuera (POS, celular, documento guardado).
 * undefined = la línea no trae peso; null = trae algo que no es un peso válido. Se redondea a
 * gramos (3 decimales), que es lo que marca una báscula comercial.
 */
export function normalizeWeightKg(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const kg = Math.round(raw * 1000) / 1000;
  return kg > 0 && kg <= MAX_WEIGHT_KG ? kg : null;
}

/** Nombre de una línea pesada para tiquetes y comandas impresas: "Queso suizo 0,350 kg". */
export function weighedName(name: string, weightKg: number | undefined): string {
  return weightKg ? `${name} ${formatKg(weightKg)}` : name;
}

/** Detalle del cobro de una pieza: "0,350 kg × ₡12 000/kg". */
export function weightDetail(weightKg: number, pricePerKg: number): string {
  return `${formatKg(weightKg)} × ₡${Math.round(pricePerKg).toLocaleString("es-CR")}/kg`;
}

/** Cuánto stock descuenta una línea: kilos en los productos por peso, unidades en el resto. */
export function stockUnits(line: { quantity: number; weightKg?: number }): number {
  return line.weightKg ? Math.round(line.weightKg * line.quantity * 1000) / 1000 : line.quantity;
}
