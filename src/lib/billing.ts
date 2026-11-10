/**
 * Cobro de la mensualidad de cada negocio: precio de lista, descuentos, planes sin costo y fechas.
 * Lógica pura, sin base: la usan el cobro automático, las rutas y las pantallas del superadmin.
 *
 * Fechas en hora de Costa Rica (UTC−6, sin horario de verano): una factura "vence el 1/12" a las
 * 00:00 de Costa Rica, y los días se cuentan en esa zona aunque el servidor corra en UTC.
 */

export type PlanKey = "emprende" | "pro" | "premium";
export const PLAN_KEYS: PlanKey[] = ["emprende", "pro", "premium"];
export const PLAN_LABELS: Record<PlanKey, string> = { emprende: "Emprende", pro: "Pro", premium: "Premium" };
export const DEFAULT_PLAN_PRICES: Record<PlanKey, number> = { emprende: 12900, pro: 17900, premium: 24900 };

export type DiscountType = "none" | "percent" | "amount";

/** Lo que el superadmin define para el cobro de un negocio. */
export interface TenantBilling {
  discountType: DiscountType;
  /** Porcentaje (1–100) o monto en colones, según discountType. */
  discountValue: number;
  /** Último día (inclusive) en que aplica el descuento; null = sin fecha de fin. */
  discountUntil: Date | string | null;
  discountLabel: string;
  free: boolean;
  /** Último día (inclusive) sin costo; null = sin fecha de fin. */
  freeUntil: Date | string | null;
  freeReason: string;
}

export const DEFAULT_TENANT_BILLING: TenantBilling = {
  discountType: "none", discountValue: 0, discountUntil: null, discountLabel: "",
  free: false, freeUntil: null, freeReason: "",
};

/** El cobro de un negocio con los valores por defecto para lo que falte (negocios viejos). */
export function billingOf(tenant: { billing?: Partial<TenantBilling> | null }): TenantBilling {
  return { ...DEFAULT_TENANT_BILLING, ...(tenant.billing ?? {}) };
}

export const formatCRC = (n: number) => `₡${Math.round(n).toLocaleString("es-CR")}`;

/** Los descuentos se redondean a los ₡100 más cercanos: 24.900 − 20% = 19.920 → 19.900. */
export const roundTo100 = (n: number) => Math.round(n / 100) * 100;

// ── Fechas en Costa Rica ─────────────────────────────────────────────────────

const CR_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CrDay { y: number; m: number; d: number }

export function crDay(date: Date): CrDay {
  const x = new Date(date.getTime() - CR_OFFSET_MS);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

/** 00:00 de Costa Rica del día dado (acepta meses y días fuera de rango: 13/2026 → 1/2027). */
export function crMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d) + CR_OFFSET_MS);
}

export function startOfCrDay(date: Date): Date {
  const { y, m, d } = crDay(date);
  return crMidnight(y, m, d);
}

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

/** Días enteros de a hasta b (ambos llevados a las 00:00 de CR). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfCrDay(b).getTime() - startOfCrDay(a).getTime()) / DAY_MS);
}

export function formatCrDate(date: Date | string): string {
  const { y, m, d } = crDay(new Date(date));
  return `${d}/${m}/${y}`;
}

/** Valor para un <input type="date"> (AAAA-MM-DD en hora de CR). */
export function toInputDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const { y, m, d } = crDay(new Date(date));
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** De un <input type="date"> a las 00:00 de CR de ese día (null si está vacío o mal). */
export function fromInputDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? crMidnight(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

export const MONTH_NAMES =["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const periodLabel = (y: number, m: number) => `${MONTH_NAMES[m - 1]} ${y}`;

/** El mes siguiente a (y, m). */
export function nextPeriod(y: number, m: number): { y: number; m: number } {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}

export const periodKey = (y: number, m: number) => y * 100 + m;

/** Fecha de vencimiento de un mes: el día de cobro a las 00:00 de CR. */
export const periodDueDate = (y: number, m: number, dueDay = 1) => crMidnight(y, m, dueDay);

// ── Precio ──────────────────────────────────────────────────────────────────

/** Si una fecha "hasta" (inclusive) todavía cubre el día dado. */
function coversDay(until: Date | string | null, day: Date): boolean {
  if (!until) return true;
  return startOfCrDay(day).getTime() <= startOfCrDay(new Date(until)).getTime();
}

export function isFreeOn(billing: TenantBilling, day: Date): boolean {
  return billing.free && coversDay(billing.freeUntil, day);
}

export function discountActiveOn(billing: TenantBilling, day: Date): boolean {
  return billing.discountType !== "none" && billing.discountValue > 0 && coversDay(billing.discountUntil, day);
}

export interface PriceBreakdown {
  listAmount: number;
  discountAmount: number;
  /** Lo que paga. 0 si es sin costo. */
  amount: number;
  /** "Cliente fundador −20%", "Cortesía", o "" sin descuento. */
  discountLabel: string;
  free: boolean;
}

export function describeDiscount(billing: TenantBilling): string {
  const amount = billing.discountType === "percent" ? `−${billing.discountValue}%` : `−${formatCRC(billing.discountValue)}`;
  return [billing.discountLabel.trim() || "Descuento", amount].join(" ");
}

/** Lo que paga un negocio por un mes, según su plan y su cobro, en la fecha de vencimiento de ese mes. */
export function priceFor(
  plan: string,
  billing: TenantBilling,
  prices: Record<PlanKey, number>,
  onDay: Date,
): PriceBreakdown {
  const listAmount = prices[plan as PlanKey] ?? DEFAULT_PLAN_PRICES[plan as PlanKey] ?? DEFAULT_PLAN_PRICES.emprende;
  if (isFreeOn(billing, onDay)) {
    return { listAmount, discountAmount: listAmount, amount: 0, discountLabel: billing.freeReason.trim() || "Cortesía", free: true };
  }
  if (!discountActiveOn(billing, onDay)) {
    return { listAmount, discountAmount: 0, amount: listAmount, discountLabel: "", free: false };
  }
  const raw = billing.discountType === "percent"
    ? listAmount * (1 - Math.min(100, billing.discountValue) / 100)
    : listAmount - billing.discountValue;
  const amount = Math.max(0, roundTo100(raw));
  return { listAmount, discountAmount: listAmount - amount, amount, discountLabel: describeDiscount(billing), free: false };
}

// ── Métodos de pago ─────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { value: "sinpe", label: "SINPE Móvil" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "otro", label: "Otro" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
