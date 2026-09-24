// Fórmulas de dinero compartidas entre pantallas y endpoints. Cliente y servidor calculan con las
// MISMAS funciones: el servidor recalcula todo con lo que tiene guardado y nunca confía en montos
// que manda el cliente, y la pantalla muestra exactamente lo que el servidor va a guardar.

export type OrderType = "LOCAL" | "PICKUP" | "EXPRESS";

export const ORDER_TYPES: OrderType[] = ["LOCAL", "PICKUP", "EXPRESS"];

export function isOrderType(v: unknown): v is OrderType {
  return typeof v === "string" && (ORDER_TYPES as string[]).includes(v);
}

/**
 * Extra con precio de un producto (Product.extras). Cada línea de comanda, venta, carrito o pedido
 * guarda su PROPIA copia congelada de los extras elegidos: si mañana cambia el precio de un extra
 * en el catálogo, lo ya comandado o vendido no cambia.
 */
export interface LineExtra {
  name: string;
  price: number;
}

export const MAX_EXTRA_NAME = 60;

/** Lo mínimo de una línea de venta, carrito o comanda para calcular su dinero. */
export interface PricedLine {
  /** Precio base del producto. Nunca incluye los extras. */
  unitPrice: number;
  quantity: number;
  /** Extras elegidos; aplican a TODAS las unidades de la línea. */
  extras?: LineExtra[];
}

export function extrasTotal(extras: LineExtra[] | undefined): number {
  return (extras ?? []).reduce((sum, e) => sum + e.price, 0);
}

/** Precio unitario efectivo: base + suma de los extras de la línea. */
export function effectiveUnitPrice(line: Pick<PricedLine, "unitPrice" | "extras">): number {
  return line.unitPrice + extrasTotal(line.extras);
}

/** Total de una línea: precio unitario efectivo por cantidad. */
export function lineTotal(line: PricedLine): number {
  return effectiveUnitPrice(line) * line.quantity;
}

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

/**
 * Total de una línea de la tienda o de un pedido manual, donde el producto puede tener ofertas por
 * volumen ("4 por ₡5400"). La oferta reemplaza solo el precio BASE de esa cantidad exacta; los
 * extras se cobran siempre por unidad encima.
 */
export function offerLineTotal(
  line: PricedLine,
  offers: { qty: number; price: number }[] | undefined,
): number {
  const offer = (offers ?? []).find((o) => o.qty === line.quantity);
  const base = offer ? offer.price : line.unitPrice * line.quantity;
  return base + extrasTotal(line.extras) * line.quantity;
}

/**
 * Valida y normaliza una lista de extras que llega de afuera (cuerpo de una petición, documento
 * viejo). Devuelve null si algo no es válido: nombre vacío o muy largo, o precio no numérico o
 * negativo. Sin lista, devuelve [].
 */
export function normalizeExtras(raw: unknown): LineExtra[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: LineExtra[] = [];
  for (const e of raw) {
    const name = typeof e?.name === "string" ? e.name.trim() : "";
    const price = e?.price;
    if (!name || name.length > MAX_EXTRA_NAME) return null;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;
    out.push({ name, price });
  }
  return out;
}

/** Clave estable de un conjunto de extras: dos líneas con la misma clave llevan lo mismo. */
export function extrasKey(extras: LineExtra[] | undefined): string {
  return (extras ?? []).map((e) => `${e.name}\u0000${e.price}`).sort().join("\u0001");
}

/** Cobros del punto de venta, fijados por el dueño en Configuración → Caja (Tenant.posConfig). */
export interface PosCharges {
  ivaEnabled: boolean;
  ivaRate: number;
  serviceEnabled: boolean;
  serviceRate: number;
  tipEnabled: boolean;
}

export const DEFAULT_POS_CHARGES: PosCharges = {
  ivaEnabled: false,
  ivaRate: 13,
  serviceEnabled: false,
  serviceRate: 10,
  tipEnabled: false,
};

function rate(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
}

/** Normaliza lo que haya en Tenant.posConfig (documentos viejos pueden no tener todos los campos). */
export function readPosCharges(raw: unknown): PosCharges {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    ivaEnabled:     c.ivaEnabled === true,
    ivaRate:        rate(c.ivaRate, DEFAULT_POS_CHARGES.ivaRate),
    serviceEnabled: c.serviceEnabled === true,
    serviceRate:    rate(c.serviceRate, DEFAULT_POS_CHARGES.serviceRate),
    tipEnabled:     c.tipEnabled === true,
  };
}

export interface SaleTotalsInput {
  subtotal: number;
  charges: PosCharges;
  orderType: OrderType;
  tipAmount?: number;
  deliveryFee?: number;
}

export interface SaleTotals {
  subtotal: number;
  ivaEnabled: boolean;
  ivaRate: number;
  ivaAmount: number;
  serviceEnabled: boolean;
  serviceRate: number;
  serviceAmount: number;
  tipEnabled: boolean;
  tipAmount: number;
  deliveryFee: number;
  total: number;
}

function nonNegative(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** El servicio se cobra únicamente en pedidos en el local; en retiro y domicilio nunca. */
export function appliesService(charges: PosCharges, orderType: OrderType): boolean {
  return charges.serviceEnabled && orderType === "LOCAL";
}

/**
 * Impuesto, servicio, propina, envío y total de una venta a partir del subtotal. El impuesto se
 * cobra en los tres tipos de pedido; el servicio, solo en LOCAL (en los demás queda apagado y en
 * cero, así no aparece ni en el resumen ni en el tiquete). El monto de la propina lo escribe el
 * cajero; si la propina no está habilitada, vale cero.
 */
export function computeSaleTotals({ subtotal, charges, orderType, tipAmount, deliveryFee }: SaleTotalsInput): SaleTotals {
  const ivaAmount = charges.ivaEnabled ? Math.round((subtotal * charges.ivaRate) / 100) : 0;
  const serviceEnabled = appliesService(charges, orderType);
  const serviceAmount = serviceEnabled ? Math.round((subtotal * charges.serviceRate) / 100) : 0;
  const tip = charges.tipEnabled ? nonNegative(tipAmount) : 0;
  const delivery = orderType === "EXPRESS" ? nonNegative(deliveryFee) : 0;
  return {
    subtotal,
    ivaEnabled: charges.ivaEnabled,
    ivaRate: charges.ivaRate,
    ivaAmount,
    serviceEnabled,
    serviceRate: charges.serviceRate,
    serviceAmount,
    tipEnabled: charges.tipEnabled,
    tipAmount: tip,
    deliveryFee: delivery,
    total: subtotal + ivaAmount + serviceAmount + tip + delivery,
  };
}
