/**
 * Cómo se cobra un producto: a precio fijo (un burrito, un café), por kilo (un queso madurado
 * que se corta y se pesa) o a precio libre (pulseras o artesanías que traen sin precio fijo: el
 * cajero escribe el precio de cada pieza al venderla). En los de kilo, `price` y `cost` son por
 * kilo; en los de precio libre, `price` es solo el sugerido que aparece escrito (0 = sin sugerido).
 */
export const SOLD_BY = ["unidad", "kg", "libre"] as const;
export type SoldBy = (typeof SOLD_BY)[number];

export function isSoldBy(v: unknown): v is SoldBy {
  return SOLD_BY.includes(v as SoldBy);
}

/** Lo que va después del precio al mostrarlo: "/kg" en los de kilo, nada en los de precio fijo. */
export function priceSuffix(soldBy: SoldBy | undefined): string {
  return soldBy === "kg" ? "/kg" : "";
}

/** Precio para mostrar en catálogos del panel: "₡12 000/kg", "₡3 500" o "Precio libre". */
export function catalogPriceLabel(price: number, soldBy: SoldBy | string | undefined): string {
  if (soldBy === "libre") return "Precio libre";
  return `₡${Math.round(price).toLocaleString("es-CR")}${soldBy === "kg" ? "/kg" : ""}`;
}

/** Precio más alto que se acepta escrito a mano: más que esto es un error de digitación. */
export const MAX_OPEN_PRICE = 5_000_000;

/**
 * Valida el precio de una pieza de precio libre que llega de afuera (POS, comanda): colones enteros,
 * mayor que cero. undefined = no viene; null = viene algo que no es un precio válido.
 */
export function normalizeOpenPrice(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  return raw > 0 && raw <= MAX_OPEN_PRICE ? raw : null;
}

/** Lee un precio escrito a mano ("4500", "4 500", "₡4.500"); null si no es un precio válido. */
export function parseOpenPrice(text: string): number | null {
  const t = text.replace(/[₡\s.,]/g, "");
  if (!/^\d+$/.test(t)) return null;
  return normalizeOpenPrice(Number(t)) ?? null;
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
