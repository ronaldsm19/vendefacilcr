// Fórmulas de dinero compartidas entre pantallas y endpoints. Cliente y servidor calculan con las
// MISMAS funciones: el servidor recalcula todo con lo que tiene guardado y nunca confía en montos
// que manda el cliente, y la pantalla muestra exactamente lo que el servidor va a guardar.

export type OrderType = "LOCAL" | "PICKUP" | "EXPRESS";

export const ORDER_TYPES: OrderType[] = ["LOCAL", "PICKUP", "EXPRESS"];

export function isOrderType(v: unknown): v is OrderType {
  return typeof v === "string" && (ORDER_TYPES as string[]).includes(v);
}

/** Lo mínimo de una línea de venta, carrito o comanda para calcular su dinero. */
export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

/** Total de una línea: precio por cantidad. */
export function lineTotal(line: PricedLine): number {
  return line.unitPrice * line.quantity;
}

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
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

/**
 * Impuesto, servicio, propina, envío y total de una venta a partir del subtotal. El monto de la
 * propina lo escribe el cajero; si la propina no está habilitada, vale cero.
 */
export function computeSaleTotals({ subtotal, charges, orderType, tipAmount, deliveryFee }: SaleTotalsInput): SaleTotals {
  const ivaAmount = charges.ivaEnabled ? Math.round((subtotal * charges.ivaRate) / 100) : 0;
  const serviceAmount = charges.serviceEnabled ? Math.round((subtotal * charges.serviceRate) / 100) : 0;
  const tip = charges.tipEnabled ? nonNegative(tipAmount) : 0;
  const delivery = orderType === "EXPRESS" ? nonNegative(deliveryFee) : 0;
  return {
    subtotal,
    ivaEnabled: charges.ivaEnabled,
    ivaRate: charges.ivaRate,
    ivaAmount,
    serviceEnabled: charges.serviceEnabled,
    serviceRate: charges.serviceRate,
    serviceAmount,
    tipEnabled: charges.tipEnabled,
    tipAmount: tip,
    deliveryFee: delivery,
    total: subtotal + ivaAmount + serviceAmount + tip + delivery,
  };
}
