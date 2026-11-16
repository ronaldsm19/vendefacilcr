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
