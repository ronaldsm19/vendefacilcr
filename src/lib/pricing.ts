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
  /** Precio de UNA porción del extra. */
  price: number;
  /** Porciones del extra por unidad de la línea (p. ej. 2 extras de camarones en un plato). Sin dato = 1. */
  qty?: number;
}

export const MAX_EXTRA_NAME = 60;
/** Tope de porciones de un mismo extra en una unidad. */
export const MAX_EXTRA_QTY = 10;

/** Porciones del extra por unidad (documentos viejos no traen qty: cuentan como 1). */
export function extraQty(e: Pick<LineExtra, "qty">): number {
  return e.qty ?? 1;
}

/** Lo mínimo de una línea de venta, carrito o comanda para calcular su dinero. */
export interface PricedLine {
  /** Precio base del producto. Nunca incluye los extras. */
  unitPrice: number;
  quantity: number;
  /** Extras elegidos; aplican a TODAS las unidades de la línea. */
  extras?: LineExtra[];
}

/** Lo que suman los extras de UNA unidad: precio × porciones de cada uno. */
export function extrasTotal(extras: LineExtra[] | undefined): number {
  return (extras ?? []).reduce((sum, e) => sum + e.price * extraQty(e), 0);
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
 * viejo). Devuelve null si algo no es válido: nombre vacío o muy largo, precio no numérico o
 * negativo, o porciones fuera de 1..MAX_EXTRA_QTY. El mismo extra repetido se junta sumando sus
 * porciones. Siempre devuelve `qty`. Sin lista, devuelve [].
 */
export function normalizeExtras(raw: unknown): LineExtra[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: LineExtra[] = [];
  for (const e of raw) {
    const name = typeof e?.name === "string" ? e.name.trim() : "";
    const price = e?.price;
    const qty = e?.qty === undefined || e?.qty === null ? 1 : e.qty;
    if (!name || name.length > MAX_EXTRA_NAME) return null;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_EXTRA_QTY) return null;
    const same = out.find((x) => x.name === name && x.price === price);
    if (same) {
      const total = extraQty(same) + qty;
      if (total > MAX_EXTRA_QTY) return null;
      same.qty = total;
    } else {
      out.push({ name, price, qty });
    }
  }
  return out;
}

/** Clave estable de un conjunto de extras: dos líneas con la misma clave llevan lo mismo. */
export function extrasKey(extras: LineExtra[] | undefined): string {
  return (extras ?? []).map((e) => `${e.name}\u0000${e.price}\u0000${extraQty(e)}`).sort().join("\u0001");
}

/** Texto corto de un extra para pantallas: "Queso extra" o "2× Extra camarones". */
export function extraLabel(e: LineExtra): string {
  const q = extraQty(e);
  return q > 1 ? `${q}× ${e.name}` : e.name;
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

/**
 * Lo que el cajero decide en ESTA venta. Un cobro solo se aplica si el negocio lo tiene activo en
 * Configuración → Caja y el cajero no lo apagó; sin dato, se aplica. El porcentaje nunca viene de acá.
 */
export interface AppliedCharges {
  iva?: boolean;
  service?: boolean;
  tip?: boolean;
}

export interface SaleTotalsInput {
  subtotal: number;
  charges: PosCharges;
  orderType: OrderType;
  tipAmount?: number;
  deliveryFee?: number;
  applied?: AppliedCharges;
}

/** Lee las decisiones por venta que manda el POS (booleanos sueltos; cualquier otra cosa = sin dato). */
export function readAppliedCharges(raw: { ivaEnabled?: unknown; serviceEnabled?: unknown; tipEnabled?: unknown }): AppliedCharges {
  const flag = (v: unknown) => (typeof v === "boolean" ? v : undefined);
  return { iva: flag(raw.ivaEnabled), service: flag(raw.serviceEnabled), tip: flag(raw.tipEnabled) };
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
 * Impuesto, servicio, propina, envío y total de una venta a partir del subtotal. Cada cobro se aplica
 * si el negocio lo tiene activo y el cajero no lo apagó en esta venta (`applied`). El impuesto va en
 * los tres tipos de pedido; el servicio, solo en LOCAL (en los demás queda apagado y en cero, así no
 * aparece ni en el resumen ni en el tiquete). El monto de la propina lo escribe el cajero; si la
 * propina no se aplica, vale cero. Los `*Enabled` del resultado dicen qué se cobró en ESTA venta.
 */
export function computeSaleTotals({ subtotal, charges, orderType, tipAmount, deliveryFee, applied }: SaleTotalsInput): SaleTotals {
  const ivaEnabled = charges.ivaEnabled && applied?.iva !== false;
  const ivaAmount = ivaEnabled ? Math.round((subtotal * charges.ivaRate) / 100) : 0;
  const serviceEnabled = appliesService(charges, orderType) && applied?.service !== false;
  const serviceAmount = serviceEnabled ? Math.round((subtotal * charges.serviceRate) / 100) : 0;
  const tipEnabled = charges.tipEnabled && applied?.tip !== false;
  const tip = tipEnabled ? nonNegative(tipAmount) : 0;
  const delivery = orderType === "EXPRESS" ? nonNegative(deliveryFee) : 0;
  return {
    subtotal,
    ivaEnabled,
    ivaRate: charges.ivaRate,
    ivaAmount,
    serviceEnabled,
    serviceRate: charges.serviceRate,
    serviceAmount,
    tipEnabled,
    tipAmount: tip,
    deliveryFee: delivery,
    total: subtotal + ivaAmount + serviceAmount + tip + delivery,
  };
}
