import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { Payment } from "@/models/Payment";
import {
  BillingSettings, BILLING_DEFAULTS, BILLING_LIMITS, BILLING_DUE_DAY, type IBillingSettings,
} from "@/models/BillingSettings";
import { ServiceError } from "@/server/errors";
import { sendMail, billingEmailHtml, getBaseUrl, escapeHtml } from "@/lib/email";
import { forgetTenantStatus } from "@/server/services/tenantAccess";
import {
  PLAN_KEYS, PLAN_LABELS, DEFAULT_PLAN_PRICES, PAYMENT_METHODS, billingOf, priceFor, isFreeOn, crDay, crMidnight, startOfCrDay,
  resolveBilling, fromInputMonth, FOUNDER_SLOTS, FOUNDER_PLAN,
  addDays, daysBetween, formatCrDate, formatCRC, periodLabel, nextPeriod, periodKey, periodDueDate,
  type PlanKey, type TenantBilling, type PriceBreakdown, type DiscountType,
} from "@/lib/billing";

/**
 * Cobro automático de las mensualidades. Lo corre una vez al día el cron de Vercel
 * (/api/cron/cobros) y, a mano, el superadmin desde Cobros (también en modo vista previa).
 *
 * Todo es idempotente: las facturas se crean con upsert y cada correo se "reserva" con una
 * escritura condicionada antes de mandarlo, así dos corridas a la vez no duplican nada.
 */

type Settings = IBillingSettings;

interface TenantLean {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  suspendedReason?: string;
  billing?: Partial<TenantBilling> & { freeEndNoticeAt?: Date | null };
}

interface PaymentLean {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  tenantName: string;
  tenantSlug: string;
  plan: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  listAmount?: number;
  discountAmount?: number;
  discountLabel?: string;
  status: string;
  dueDate: Date;
  reminders?: { beforeAt?: Date | null; dueAt?: Date | null; suspendedAt?: Date | null };
  /** Comprobantes que subió el dueño desde Mensualidad (las facturas viejas no los tienen). */
  proofs?: { status: string }[];
  review?: { status?: string };
}

/** El dueño ya subió un comprobante y falta que lo revisemos: la demora es nuestra, no suya. */
const inReview = (inv: Pick<PaymentLean, "review">) => inv.review?.status === "submitted";

const TENANT_FIELDS = "_id slug name email plan status suspendedReason billing";

// ── Configuración ───────────────────────────────────────────────────────────

export async function getBillingSettings(): Promise<Settings> {
  await connectToDatabase();
  return BillingSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global", ...BILLING_DEFAULTS } },
    { upsert: true, returnDocument: "after" },
  ).lean() as Promise<Settings>;
}

/**
 * Precios de lista para páginas públicas (el landing). Solo lee: a diferencia de getBillingSettings,
 * no crea la configuración si todavía no existe.
 */
export async function getListPrices(): Promise<Record<PlanKey, number>> {
  await connectToDatabase();
  const doc = (await BillingSettings.findOne({ key: "global" }).select("prices").lean()) as
    | { prices?: Partial<Record<PlanKey, number>> }
    | null;
  const prices = { ...DEFAULT_PLAN_PRICES };
  for (const plan of PLAN_KEYS) {
    const value = doc?.prices?.[plan];
    if (typeof value === "number" && value > 0) prices[plan] = value;
  }
  return prices;
}

function intIn(value: unknown, { min, max }: { min: number; max: number }, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ServiceError(400, `${label}: tiene que ser un número entero entre ${min} y ${max}`);
  }
  return value;
}

function text(value: unknown, max: number, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ServiceError(400, `${label}: texto inválido`);
  const t = value.trim();
  if (t.length > max) throw new ServiceError(400, `${label}: hasta ${max} caracteres`);
  return t;
}

/** Valida y guarda la configuración que llega del superadmin. */
export async function updateBillingSettings(raw: Record<string, unknown>, updatedBy: string): Promise<Settings> {
  if (typeof raw.enabled !== "boolean") throw new ServiceError(400, "Falta indicar si el cobro automático está encendido");
  if (typeof raw.autoSuspend !== "boolean") throw new ServiceError(400, "Falta indicar si se suspende automáticamente");
  const prices = (raw.prices ?? {}) as Record<string, unknown>;
  const payment = (raw.payment ?? {}) as Record<string, unknown>;

  const set: Record<string, unknown> = {
    enabled: raw.enabled,
    autoSuspend: raw.autoSuspend,
    reminderDays: intIn(raw.reminderDays, BILLING_LIMITS.reminderDays, "Días de aviso"),
    graceDays: intIn(raw.graceDays, BILLING_LIMITS.graceDays, "Días de gracia"),
    payment: {
      sinpeNumber: text(payment.sinpeNumber, 20, "SINPE Móvil"),
      sinpeName: text(payment.sinpeName, 80, "Nombre del SINPE"),
      iban: text(payment.iban, 40, "IBAN"),
      ibanName: text(payment.ibanName, 80, "Nombre de la cuenta"),
      whatsapp: text(payment.whatsapp, 20, "WhatsApp"),
      notes: text(payment.notes, 300, "Indicaciones"),
    },
    updatedBy,
  };
  for (const plan of PLAN_KEYS) {
    set[`prices.${plan}`] = intIn(prices[plan], BILLING_LIMITS.price, `Precio ${PLAN_LABELS[plan]}`);
  }

  const current = await getBillingSettings();
  if (raw.enabled && !current.enabled) {
    // Al encender, solo se manejan facturas desde el mes siguiente: las viejas "pendientes" que nunca
    // se marcaron no pueden disparar una suspensión. Si se apaga y se vuelve a encender, igual.
    const { y, m } = crDay(new Date());
    const next = nextPeriod(y, m);
    set.startPeriod = Math.max(current.startPeriod ?? 0, periodKey(next.y, next.m));
  }

  return BillingSettings.findOneAndUpdate({ key: "global" }, { $set: set }, { returnDocument: "after" }).lean() as Promise<Settings>;
}

// ── Facturas ────────────────────────────────────────────────────────────────

const isCourtesy = (price: PriceBreakdown) => price.free || price.amount === 0;

/**
 * La factura de un mes para un negocio, si todavía no existe. Una factura creada tarde (negocio
 * nuevo a mitad de mes, o reactivado) nunca vence en el pasado: vence dentro de los días de aviso.
 */
function invoiceFor(tenant: TenantLean, y: number, m: number, settings: Settings, today: Date) {
  const periodDue = periodDueDate(y, m, BILLING_DUE_DAY);
  const dueDate = new Date(Math.max(periodDue.getTime(), addDays(startOfCrDay(today), settings.reminderDays).getTime()));
  const price = priceFor(tenant.plan, billingOf(tenant), settings.prices, periodDue);
  return {
    price,
    doc: {
      tenantId: tenant._id, tenantName: tenant.name, tenantSlug: tenant.slug, plan: tenant.plan,
      periodYear: y, periodMonth: m,
      amount: price.amount, listAmount: price.listAmount, discountAmount: price.discountAmount, discountLabel: price.discountLabel,
      dueDate, status: isCourtesy(price) ? "cortesia" : "pending",
    },
  };
}

export async function ensureInvoice(tenant: TenantLean, y: number, m: number, settings: Settings, today = new Date()) {
  const { doc, price } = invoiceFor(tenant, y, m, settings, today);
  const r = await Payment.updateOne(
    { tenantId: tenant._id, periodYear: y, periodMonth: m },
    { $setOnInsert: doc },
    { upsert: true },
  );
  return { created: Boolean(r.upsertedId), price, dueDate: doc.dueDate };
}

/** Genera a mano las facturas de un mes para todos los negocios activos (botón de Pagos). */
export async function generateMonth(y: number, m: number) {
  await connectToDatabase();
  const settings = await getBillingSettings();
  const tenants = await Tenant.find({ status: "active" }).select(TENANT_FIELDS).lean() as unknown as TenantLean[];
  let created = 0;
  for (const t of tenants) if ((await ensureInvoice(t, y, m, settings)).created) created++;
  return { created };
}

// ── Correos ─────────────────────────────────────────────────────────────────

type EmailKind = "recordatorio" | "vence_hoy" | "vencida" | "suspendido" | "fin_gratis";

type EmailRow = { label: string; value: string; muted?: boolean };

function invoiceRows(p: { plan: string; periodYear: number; periodMonth: number; amount: number; listAmount?: number; discountAmount?: number; discountLabel?: string }): EmailRow[] {
  const list = p.listAmount ?? p.amount;
  const rows: EmailRow[] = [{ label: `Plan ${PLAN_LABELS[p.plan as PlanKey] ?? p.plan} · ${periodLabel(p.periodYear, p.periodMonth)}`, value: formatCRC(list) }];
  if ((p.discountAmount ?? 0) > 0) rows.push({ label: p.discountLabel || "Descuento", value: `−${formatCRC(p.discountAmount ?? 0)}`, muted: true });
  return rows;
}

function billingEmail(kind: EmailKind, tenant: TenantLean, settings: Settings, invoice?: PaymentLean, extra?: { freeUntil?: Date; nextPrice?: PriceBreakdown; nextDue?: Date }) {
  const name = `<strong>${escapeHtml(tenant.name)}</strong>`;
  const panelUrl = `${getBaseUrl()}/${tenant.slug}/admin`;
  const limit = invoice ? formatCrDate(addDays(invoice.dueDate, settings.graceDays)) : "";
  const suspendNote = settings.autoSuspend && invoice
    ? `Si el pago no se registra a más tardar el <strong>${limit}</strong>, el panel y la tienda en línea se suspenden hasta ponerse al día.`
    : undefined;

  if (kind === "fin_gratis") {
    const price = extra!.nextPrice!;
    const rows: EmailRow[] = [{ label: `Plan ${PLAN_LABELS[tenant.plan as PlanKey] ?? tenant.plan}`, value: formatCRC(price.listAmount) }];
    if (price.discountAmount > 0 && !price.free) rows.push({ label: price.discountLabel, value: `−${formatCRC(price.discountAmount)}`, muted: true });
    return {
      subject: `Tu periodo sin costo en Ennea termina el ${formatCrDate(extra!.freeUntil!)}`,
      html: billingEmailHtml({
        title: "Tu periodo sin costo termina pronto",
        intro: `Hola, ${name}. Tu periodo sin costo termina el <strong>${formatCrDate(extra!.freeUntil!)}</strong>. Desde ahí, tu mensualidad queda así:`,
        rows, totalLabel: "Mensualidad", totalValue: formatCRC(price.amount),
        note: extra!.nextDue ? `El primer cobro vence el <strong>${formatCrDate(extra!.nextDue)}</strong>.` : undefined,
        payment: settings.payment, panelUrl,
      }),
    };
  }

  const inv = invoice!;
  const due = formatCrDate(inv.dueDate);
  const period = periodLabel(inv.periodYear, inv.periodMonth);
  const base = { rows: invoiceRows(inv), totalLabel: "Total a pagar", totalValue: formatCRC(inv.amount), payment: settings.payment, panelUrl };
  switch (kind) {
    case "recordatorio":
      return {
        subject: `Tu mensualidad de Ennea vence el ${due}`,
        html: billingEmailHtml({ ...base, title: "Tu mensualidad vence pronto", intro: `Hola, ${name}. Te recordamos que tu mensualidad de <strong>${period}</strong> vence el <strong>${due}</strong>.`, note: suspendNote }),
      };
    case "vence_hoy":
      return {
        subject: "Hoy vence tu mensualidad de Ennea",
        html: billingEmailHtml({ ...base, title: "Hoy vence tu mensualidad", intro: `Hola, ${name}. Hoy vence tu mensualidad de <strong>${period}</strong>.`, note: suspendNote }),
      };
    case "vencida":
      return {
        subject: "Tu mensualidad de Ennea está vencida",
        html: billingEmailHtml({ ...base, title: "Tu mensualidad está vencida", intro: `Hola, ${name}. Tu mensualidad de <strong>${period}</strong> venció el <strong>${due}</strong> y todavía no está registrada.`, note: suspendNote }),
      };
    case "suspendido":
      return {
        subject: `Suspendimos el acceso de ${tenant.name} por falta de pago`,
        html: billingEmailHtml({
          ...base, title: "Acceso suspendido por falta de pago",
          intro: `Hola, ${name}. Como no se registró el pago de <strong>${period}</strong>, el panel y la tienda en línea quedaron suspendidos.`,
          note: "Apenas se registre el pago, el acceso vuelve automáticamente.",
        }),
      };
  }
}

async function send(tenant: TenantLean, mail: { subject: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  if (!tenant.email) return { ok: false, error: "El negocio no tiene correo" };
  return sendMail({ to: tenant.email, subject: mail.subject, html: mail.html });
}

/** Reserva un recordatorio (solo una corrida lo manda); si el correo falla, se libera para mañana. */
async function claimReminder(id: mongoose.Types.ObjectId, field: "beforeAt" | "dueAt" | "suspendedAt", now: Date): Promise<boolean> {
  const r = await Payment.updateOne({ _id: id, [`reminders.${field}`]: null }, { $set: { [`reminders.${field}`]: now } });
  return r.modifiedCount === 1;
}
const releaseReminder = (id: mongoose.Types.ObjectId, field: "beforeAt" | "dueAt") =>
  Payment.updateOne({ _id: id }, { $set: { [`reminders.${field}`]: null } });

// ── Corrida diaria ──────────────────────────────────────────────────────────

export type BillingActionType = "factura" | "cortesia" | "recordatorio" | "vence_hoy" | "vencida" | "atrasada" | "suspension" | "fin_gratis";

export interface BillingAction {
  type: BillingActionType;
  tenantSlug: string;
  tenantName: string;
  detail: string;
  amount?: number;
  /** Error del correo, si no salió (se reintenta mañana). */
  emailError?: string;
}

export interface BillingRunResult {
  ranAt: string;
  dryRun: boolean;
  enabled: boolean;
  /** Primer mes que maneja (yyyymm). En una vista previa con el cobro apagado, el que tendría al encenderlo. */
  startPeriod: number;
  actions: BillingAction[];
  summary: string;
  upcoming: {
    period: string;
    reminderDate: string;
    dueDate: string;
    suspendDate: string | null;
    tenants: number;
    expected: number;
    courtesies: number;
  };
}

const ACTION_LABELS: Record<BillingActionType, [string, string]> = {
  factura: ["factura creada", "facturas creadas"],
  cortesia: ["cortesía registrada", "cortesías registradas"],
  recordatorio: ["recordatorio", "recordatorios"],
  vence_hoy: ["aviso de vencimiento", "avisos de vencimiento"],
  vencida: ["aviso de vencida", "avisos de vencida"],
  atrasada: ["factura atrasada", "facturas atrasadas"],
  suspension: ["suspensión", "suspensiones"],
  fin_gratis: ["aviso de fin de cortesía", "avisos de fin de cortesía"],
};

function summarize(actions: BillingAction[]): string {
  if (!actions.length) return "Nada que hacer hoy";
  const counts = new Map<BillingActionType, number>();
  for (const a of actions) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  return [...counts].map(([t, n]) => `${n} ${ACTION_LABELS[t][n === 1 ? 0 : 1]}`).join(", ");
}

/**
 * La corrida diaria. Con dryRun no escribe ni manda nada: devuelve lo que haría hoy (sirve para
 * revisar antes de encender el cobro automático). `now` permite probar otras fechas en desarrollo.
 */
export async function runBillingCycle(
  { now = new Date(), dryRun = false, onlySlugs }: { now?: Date; dryRun?: boolean; onlySlugs?: string[] } = {},
): Promise<BillingRunResult> {
  await connectToDatabase();
  const settings = await getBillingSettings();
  const today = startOfCrDay(now);
  const { y, m } = crDay(now);
  const next = nextPeriod(y, m);
  const startPeriod = settings.startPeriod ?? periodKey(next.y, next.m);
  const actions: BillingAction[] = [];

  // onlySlugs: solo para pruebas en desarrollo (ver /api/superadmin/cobros/ejecutar).
  const tenants = await Tenant.find(onlySlugs ? { slug: { $in: onlySlugs } } : {}).select(TENANT_FIELDS).lean() as unknown as TenantLean[];
  const byId = new Map(tenants.map((t) => [String(t._id), t]));
  const activeTenants = tenants.filter((t) => t.status === "active");

  const upcoming = buildUpcoming(activeTenants, settings, next.y, next.m);

  if (!settings.enabled && !dryRun) {
    return { ranAt: now.toISOString(), dryRun, enabled: false, startPeriod, actions, summary: "El cobro automático está apagado", upcoming };
  }

  // 1. Facturas del mes actual y, si ya está dentro de los días de aviso, del siguiente.
  const periods = [{ y, m }];
  if (daysBetween(today, periodDueDate(next.y, next.m, BILLING_DUE_DAY)) <= settings.reminderDays) periods.push(next);
  const virtual: PaymentLean[] = [];
  for (const p of periods) {
    if (periodKey(p.y, p.m) < startPeriod) continue;
    const existing = new Set(
      (await Payment.find({ periodYear: p.y, periodMonth: p.m, tenantId: { $in: activeTenants.map((t) => t._id) } }).select("tenantId").lean() as unknown as { tenantId: unknown }[])
        .map((x) => String(x.tenantId)),
    );
    for (const t of activeTenants) {
      if (existing.has(String(t._id))) continue;
      const { doc, price } = invoiceFor(t, p.y, p.m, settings, now);
      actions.push({
        type: isCourtesy(price) ? "cortesia" : "factura", tenantSlug: t.slug, tenantName: t.name, amount: price.amount,
        detail: `${periodLabel(p.y, p.m)} · ${isCourtesy(price) ? price.discountLabel : `${formatCRC(price.amount)}, vence el ${formatCrDate(doc.dueDate)}`}`,
      });
      if (dryRun) virtual.push({ ...doc, _id: new mongoose.Types.ObjectId(), reminders: {} } as unknown as PaymentLean);
      else await ensureInvoice(t, p.y, p.m, settings, now);
    }
  }

  // 2. Recordatorios, atrasos y suspensiones de las facturas que maneja el cobro automático.
  const sy = Math.floor(startPeriod / 100);
  const sm = startPeriod % 100;
  const open = await Payment.find({
    status: { $in: ["pending", "late"] },
    $or: [{ periodYear: { $gt: sy } }, { periodYear: sy, periodMonth: { $gte: sm } }],
    ...(onlySlugs ? { tenantId: { $in: tenants.map((t) => t._id) } } : {}),
  }).sort({ dueDate: 1 }).lean() as unknown as PaymentLean[];

  for (const inv of [...open, ...virtual]) {
    const tenant = byId.get(String(inv.tenantId));
    if (!tenant) continue;
    // Con un comprobante esperando revisión no se recuerda, no se atrasa ni se suspende.
    if (inReview(inv)) continue;
    const invDue = periodDueDate(inv.periodYear, inv.periodMonth, BILLING_DUE_DAY);
    if (isFreeOn(resolveBilling(tenant.plan, billingOf(tenant), invDue), invDue)) continue;
    const reminders = inv.reminders ?? {};
    const daysToDue = daysBetween(today, inv.dueDate);
    const who = { tenantSlug: tenant.slug, tenantName: tenant.name, amount: inv.amount };
    const period = periodLabel(inv.periodYear, inv.periodMonth);

    // Recordatorio antes de vencer.
    if (daysToDue > 0 && daysToDue <= settings.reminderDays && !reminders.beforeAt) {
      const action: BillingAction = { type: "recordatorio", ...who, detail: `${period} · vence el ${formatCrDate(inv.dueDate)}` };
      actions.push(action);
      if (!dryRun && await claimReminder(inv._id, "beforeAt", now)) {
        const r = await send(tenant, billingEmail("recordatorio", tenant, settings, inv)!);
        if (!r.ok) { action.emailError = r.error; await releaseReminder(inv._id, "beforeAt"); }
      }
    }

    // Aviso el día que vence (o, si el cron no corrió ese día, el primero dentro de la gracia).
    if (daysToDue <= 0 && -daysToDue <= settings.graceDays && !reminders.dueAt) {
      const kind = daysToDue === 0 ? "vence_hoy" : "vencida";
      const action: BillingAction = { type: kind, ...who, detail: `${period} · ${daysToDue === 0 ? "vence hoy" : `venció el ${formatCrDate(inv.dueDate)}`}` };
      actions.push(action);
      if (!dryRun && await claimReminder(inv._id, "dueAt", now)) {
        const r = await send(tenant, billingEmail(kind, tenant, settings, inv)!);
        if (!r.ok) { action.emailError = r.error; await releaseReminder(inv._id, "dueAt"); }
      }
    }

    // Pasó el vencimiento: atrasada.
    if (daysToDue < 0 && inv.status === "pending") {
      actions.push({ type: "atrasada", ...who, detail: `${period} · venció el ${formatCrDate(inv.dueDate)}` });
      if (!dryRun) await Payment.updateOne({ _id: inv._id, status: "pending" }, { $set: { status: "late" } });
    }

    // Pasó la gracia: se suspende, una sola vez por factura (si el superadmin lo reactiva a mano
    // sin el pago, no se lo vuelve a suspender por esta misma factura).
    if (daysToDue < 0 && -daysToDue > settings.graceDays && settings.autoSuspend && tenant.status === "active" && !reminders.suspendedAt) {
      const action: BillingAction = { type: "suspension", ...who, detail: `${period} · sin pago desde el ${formatCrDate(inv.dueDate)}` };
      actions.push(action);
      tenant.status = "suspended";
      if (!dryRun && await claimReminder(inv._id, "suspendedAt", now)) {
        await Tenant.updateOne(
          { _id: tenant._id, status: "active" },
          { $set: { status: "suspended", suspendedReason: "falta_pago", suspendedMessage: "", suspendedAt: now } },
        );
        forgetTenantStatus(String(tenant._id));
        const r = await send(tenant, billingEmail("suspendido", tenant, settings, inv)!);
        if (!r.ok) action.emailError = r.error;
      }
    }
  }

  // 3. Aviso 7 días antes de que termine un periodo sin costo con fecha de fin (también el mes sin
  // costo del programa de fundadores).
  for (const t of activeTenants) {
    const b = resolveBilling(t.plan, billingOf(t), today);
    if (!b.free || !b.freeUntil || t.billing?.freeEndNoticeAt) continue;
    const left = daysBetween(today, new Date(b.freeUntil));
    if (left < 0 || left > 7) continue;
    const freeUntil = new Date(b.freeUntil);
    const after = crDay(addDays(freeUntil, 1));
    const firstPeriod = after.d === 1 ? after : nextPeriod(after.y, after.m);
    const nextDue = periodDueDate(firstPeriod.y, firstPeriod.m, BILLING_DUE_DAY);
    const nextPrice = priceFor(t.plan, { ...b, free: false }, settings.prices, nextDue);
    const action: BillingAction = { type: "fin_gratis", tenantSlug: t.slug, tenantName: t.name, amount: nextPrice.amount, detail: `termina el ${formatCrDate(freeUntil)}` };
    actions.push(action);
    if (!dryRun) {
      const claimed = await Tenant.updateOne({ _id: t._id, "billing.freeEndNoticeAt": null }, { $set: { "billing.freeEndNoticeAt": now } });
      if (claimed.modifiedCount === 1) {
        const r = await send(t, billingEmail("fin_gratis", t, settings, undefined, { freeUntil, nextPrice, nextDue })!);
        if (!r.ok) { action.emailError = r.error; await Tenant.updateOne({ _id: t._id }, { $set: { "billing.freeEndNoticeAt": null } }); }
      }
    }
  }

  const summary = summarize(actions);
  if (!dryRun) {
    const failed = actions.filter((a) => a.emailError);
    await BillingSettings.updateOne({ key: "global" }, {
      $set: {
        lastRunAt: now, lastRunSummary: summary,
        lastRunError: failed.length ? `${failed.length} correo(s) sin enviar: ${failed[0].emailError}` : "",
      },
    });
  }
  return { ranAt: now.toISOString(), dryRun, enabled: settings.enabled, startPeriod, actions, summary, upcoming };
}

/** Lo próximo que va a pasar: el siguiente cobro, cuándo sale el aviso y cuánto se espera. */
function buildUpcoming(tenants: TenantLean[], settings: Settings, y: number, m: number): BillingRunResult["upcoming"] {
  const due = periodDueDate(y, m, BILLING_DUE_DAY);
  let expected = 0;
  let paying = 0;
  let courtesies = 0;
  for (const t of tenants) {
    const price = priceFor(t.plan, billingOf(t), settings.prices, due);
    if (isCourtesy(price)) courtesies++;
    else { paying++; expected += price.amount; }
  }
  return {
    period: periodLabel(y, m),
    reminderDate: formatCrDate(addDays(due, -settings.reminderDays)),
    dueDate: formatCrDate(due),
    suspendDate: settings.autoSuspend ? formatCrDate(addDays(due, settings.graceDays + 1)) : null,
    tenants: paying,
    expected,
    courtesies,
  };
}

// ── Pagos ───────────────────────────────────────────────────────────────────

/**
 * Registra el pago de una factura. Si el negocio estaba suspendido por falta de pago y ya no le queda
 * nada vencido más allá de la gracia (en los meses que maneja el cobro automático), se reactiva.
 *
 * Si el dueño había subido comprobantes que esperaban revisión, quedan aprobados: registrar el pago
 * a mano o desde la revisión es lo mismo.
 */
export async function markPaid(
  paymentId: string,
  raw: { method?: unknown; reference?: unknown; paidAt?: unknown; notes?: unknown },
  reviewedBy = "",
): Promise<{ payment: unknown; reactivated: boolean; approvedProofs: boolean }> {
  if (!mongoose.isValidObjectId(paymentId)) throw new ServiceError(404, "Factura no encontrada");
  await connectToDatabase();
  const payment = await Payment.findById(paymentId).lean() as PaymentLean | null;
  if (!payment) throw new ServiceError(404, "Factura no encontrada");
  if (payment.status === "cortesia" || payment.status === "cancelled") {
    throw new ServiceError(400, "Esta factura no se cobra (cortesía o anulada)");
  }

  const method = raw.method === undefined || raw.method === "" ? "" : raw.method;
  if (method && !PAYMENT_METHODS.some((p) => p.value === method)) throw new ServiceError(400, "Método de pago inválido");
  let paidAt = new Date();
  if (raw.paidAt) {
    paidAt = new Date(String(raw.paidAt));
    if (Number.isNaN(paidAt.getTime())) throw new ServiceError(400, "Fecha de pago inválida");
  }
  const set: Record<string, unknown> = { status: "paid", paidAt, method, reference: text(raw.reference, 80, "Referencia") };
  if (raw.notes !== undefined) set.notes = text(raw.notes, 300, "Notas");
  const approvedProofs = (payment.proofs ?? []).some((p) => p.status === "submitted");
  if (approvedProofs) {
    Object.assign(set, {
      "proofs.$[p].status": "approved",
      "review.status": "approved", "review.reviewedAt": new Date(), "review.reviewedBy": reviewedBy,
      "review.reason": "", "review.ownerSeenAt": null,
    });
  }
  const updated = await Payment.findByIdAndUpdate(
    paymentId,
    { $set: set },
    { returnDocument: "after", ...(approvedProofs ? { arrayFilters: [{ "p.status": "submitted" }] } : {}) },
  ).lean();

  let reactivated = false;
  const tenant = await Tenant.findById(payment.tenantId).select("status suspendedReason").lean() as { status: string; suspendedReason?: string } | null;
  if (tenant?.status === "suspended" && tenant.suspendedReason === "falta_pago") {
    const settings = await getBillingSettings();
    let overdue = false;
    if (settings.startPeriod) {
      const sy = Math.floor(settings.startPeriod / 100);
      const sm = settings.startPeriod % 100;
      overdue = Boolean(await Payment.exists({
        tenantId: payment.tenantId,
        _id: { $ne: payment._id },
        status: { $in: ["pending", "late"] },
        dueDate: { $lt: addDays(startOfCrDay(new Date()), -settings.graceDays) },
        $or: [{ periodYear: { $gt: sy } }, { periodYear: sy, periodMonth: { $gte: sm } }],
      }));
    }
    if (!overdue) {
      const r = await Tenant.updateOne(
        { _id: payment.tenantId, status: "suspended", suspendedReason: "falta_pago" },
        { $set: { status: "active", suspendedReason: "", suspendedMessage: "", suspendedAt: null } },
      );
      reactivated = r.modifiedCount === 1;
      if (reactivated) forgetTenantStatus(String(payment.tenantId));
    }
  }
  return { payment: updated, reactivated, approvedProofs };
}

/**
 * Convierte en cortesía una factura sin pagar (por ejemplo, un mes viejo de un negocio que nunca
 * pagó porque siempre fue sin costo). Queda registrado cuánto se regaló: lista = descuento, paga ₡0.
 */
export async function markCourtesy(paymentId: string, rawReason?: unknown) {
  if (!mongoose.isValidObjectId(paymentId)) throw new ServiceError(404, "Factura no encontrada");
  await connectToDatabase();
  const payment = await Payment.findById(paymentId).lean() as PaymentLean | null;
  if (!payment) throw new ServiceError(404, "Factura no encontrada");
  if (payment.status !== "pending" && payment.status !== "late") {
    throw new ServiceError(400, "Solo se puede pasar a cortesía una factura sin pagar");
  }
  const list = payment.listAmount ?? payment.amount;
  const label = text(rawReason, 60, "Motivo") || "Cortesía";
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: payment.status },
    { $set: { status: "cortesia", amount: 0, listAmount: list, discountAmount: list, discountLabel: label } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw new ServiceError(409, "La factura cambió mientras tanto. Recargá la página.");
  return { payment: updated, reactivated: false };
}

// ── Cobro de un negocio ─────────────────────────────────────────────────────

function parseDay(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) throw new ServiceError(400, `${label}: fecha inválida`);
  return crMidnight(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Lo que ve el superadmin en la ficha: el cobro del negocio, el precio de este mes y del siguiente. */
export async function tenantBillingView(tenantId: string) {
  if (!mongoose.isValidObjectId(tenantId)) throw new ServiceError(404, "Negocio no encontrado");
  await connectToDatabase();
  const [tenant, settings] = await Promise.all([
    Tenant.findById(tenantId).select(TENANT_FIELDS).lean() as Promise<TenantLean | null>,
    getBillingSettings(),
  ]);
  if (!tenant) throw new ServiceError(404, "Negocio no encontrado");
  const { y, m } = crDay(new Date());
  const next = nextPeriod(y, m);
  const [unpaid, foundersUsed] = await Promise.all([
    Payment.find({ tenantId: tenant._id, status: { $in: ["pending", "late"] } })
      .sort({ dueDate: 1 }).select("periodYear periodMonth amount dueDate status").lean(),
    Tenant.countDocuments({ "billing.founderStart": { $ne: null } }),
  ]);
  return {
    plan: tenant.plan,
    billing: billingOf(tenant),
    founderSlots: { used: foundersUsed, total: FOUNDER_SLOTS },
    prices: settings.prices,
    automationEnabled: settings.enabled,
    current: { period: periodLabel(y, m), ...priceFor(tenant.plan, billingOf(tenant), settings.prices, periodDueDate(y, m, BILLING_DUE_DAY)) },
    next: { period: periodLabel(next.y, next.m), ...priceFor(tenant.plan, billingOf(tenant), settings.prices, periodDueDate(next.y, next.m, BILLING_DUE_DAY)) },
    unpaid,
  };
}

/**
 * Guarda el descuento, el periodo sin costo o el programa de fundadores de un negocio. Las facturas
 * sin pagar de este mes en adelante se recalculan (las viejas y las pagadas quedan como están).
 */
export async function updateTenantBilling(tenantId: string, raw: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(tenantId)) throw new ServiceError(404, "Negocio no encontrado");
  await connectToDatabase();
  const tenant = await Tenant.findById(tenantId).select(TENANT_FIELDS).lean() as TenantLean | null;
  if (!tenant) throw new ServiceError(404, "Negocio no encontrado");

  const rawType = raw.discountType ?? "none";
  if (rawType !== "none" && rawType !== "percent" && rawType !== "amount") {
    throw new ServiceError(400, "Tipo de descuento inválido");
  }
  const discountType: DiscountType = rawType;
  let discountValue = 0;
  if (discountType === "percent") discountValue = intIn(raw.discountValue, { min: 1, max: 100 }, "Porcentaje de descuento");
  if (discountType === "amount") discountValue = intIn(raw.discountValue, { min: 100, max: BILLING_LIMITS.price.max }, "Monto de descuento");
  if (typeof raw.free !== "boolean") throw new ServiceError(400, "Falta indicar si es sin costo");

  // Programa de fundadores: solo en Premium y con cupo. Mientras esté, el precio lo maneja el
  // calendario del programa y el descuento o la cortesía manuales se limpian.
  const founder = raw.founder === true;
  const wasFounder = Boolean(tenant.billing?.founderStart);
  let founderStart: Date | null = null;
  if (founder) {
    if (tenant.plan !== FOUNDER_PLAN) throw new ServiceError(400, "El programa de fundadores es solo para el plan Premium");
    founderStart = typeof raw.founderStart === "string" ? fromInputMonth(raw.founderStart) : null;
    if (!founderStart) throw new ServiceError(400, "Elegí el primer mes del programa");
    if (!wasFounder) {
      const used = await Tenant.countDocuments({ "billing.founderStart": { $ne: null } });
      if (used >= FOUNDER_SLOTS) throw new ServiceError(409, `Ya se usaron los ${FOUNDER_SLOTS} cupos del programa de fundadores`);
    }
  }

  const free = founder ? false : raw.free;
  const freeUntil = free ? parseDay(raw.freeUntil, "Sin costo hasta") : null;
  const previousFreeUntil = tenant.billing?.freeUntil ? new Date(tenant.billing.freeUntil).getTime() : null;
  const previousFounderStart = tenant.billing?.founderStart ? new Date(tenant.billing.founderStart).getTime() : null;
  const manualDiscount = founder ? "none" : discountType;
  const billing = {
    discountType: manualDiscount,
    discountValue: manualDiscount === "none" ? 0 : discountValue,
    discountUntil: manualDiscount === "none" ? null : parseDay(raw.discountUntil, "Descuento hasta"),
    discountLabel: manualDiscount === "none" ? "" : text(raw.discountLabel, 60, "Etiqueta del descuento"),
    free,
    freeUntil,
    freeReason: free ? text(raw.freeReason, 60, "Motivo") : "",
    founderStart,
    // Si cambia la fecha de fin (o el programa), el aviso de "termina pronto" vuelve a salir.
    freeEndNoticeAt: (freeUntil?.getTime() ?? null) === previousFreeUntil && (founderStart?.getTime() ?? null) === previousFounderStart
      ? tenant.billing?.freeEndNoticeAt ?? null
      : null,
  };
  await Tenant.updateOne({ _id: tenant._id }, { $set: { billing } });
  const recalculated = await repriceOpenInvoices({ ...tenant, billing });
  return { ...(await tenantBillingView(tenantId)), recalculated };
}

/**
 * Pone al precio de hoy las facturas sin pagar de este mes en adelante (cortesía si quedan en cero),
 * con el plan actual del negocio. Se llama al cambiar su cobro (descuento, cortesía, fundador) y al
 * cambiarle el plan: la factura del mes pudo crearse antes, cuando el dueño abrió Mensualidad, con el
 * precio o el plan viejo. Los meses pasados no se tocan.
 */
export async function repriceOpenInvoices(
  tenant: Pick<TenantLean, "_id" | "plan" | "billing">,
  now = new Date(),
): Promise<number> {
  if (!PLAN_KEYS.includes(tenant.plan as PlanKey)) return 0;
  const settings = await getBillingSettings();
  const { y, m } = crDay(now);
  const open = await Payment.find({
    tenantId: tenant._id,
    status: { $in: ["pending", "late", "cortesia"] },
    $or: [{ periodYear: { $gt: y } }, { periodYear: y, periodMonth: { $gte: m } }],
  }).lean() as unknown as PaymentLean[];
  let recalculated = 0;
  for (const inv of open) {
    const price = priceFor(tenant.plan, billingOf(tenant), settings.prices, periodDueDate(inv.periodYear, inv.periodMonth, BILLING_DUE_DAY));
    const status = isCourtesy(price) ? "cortesia" : inv.status === "cortesia" ? "pending" : inv.status;
    if (
      inv.plan === tenant.plan && price.amount === inv.amount && status === inv.status
      && price.listAmount === (inv.listAmount ?? inv.amount) && price.discountLabel === (inv.discountLabel ?? "")
    ) continue;
    // Condicionado al estado leído: si justo se pagó o se anuló, no se toca.
    const r = await Payment.updateOne({ _id: inv._id, status: inv.status }, {
      $set: {
        plan: tenant.plan, amount: price.amount, listAmount: price.listAmount,
        discountAmount: price.discountAmount, discountLabel: price.discountLabel, status,
      },
    });
    recalculated += r.modifiedCount;
  }
  return recalculated;
}

/** Manda a mano el aviso de la factura sin pagar más antigua de un negocio. */
export async function sendManualReminder(tenantId: string) {
  if (!mongoose.isValidObjectId(tenantId)) throw new ServiceError(404, "Negocio no encontrado");
  await connectToDatabase();
  const [tenant, settings] = await Promise.all([
    Tenant.findById(tenantId).select(TENANT_FIELDS).lean() as Promise<TenantLean | null>,
    getBillingSettings(),
  ]);
  if (!tenant) throw new ServiceError(404, "Negocio no encontrado");
  const inv = await Payment.findOne({ tenantId: tenant._id, status: { $in: ["pending", "late"] } }).sort({ dueDate: 1 }).lean() as PaymentLean | null;
  if (!inv) throw new ServiceError(400, "No tiene cobros pendientes");
  const daysToDue = daysBetween(new Date(), inv.dueDate);
  const kind: EmailKind = daysToDue > 0 ? "recordatorio" : daysToDue === 0 ? "vence_hoy" : "vencida";
  const r = await send(tenant, billingEmail(kind, tenant, settings, inv)!);
  if (!r.ok) throw new ServiceError(502, `No se pudo enviar el correo: ${r.error ?? "error desconocido"}`);
  return { sentTo: tenant.email, period: periodLabel(inv.periodYear, inv.periodMonth), amount: inv.amount };
}

/**
 * Lo que ve el dueño en su panel ("Mi plan"): su plan, cuánto paga y por qué, cuándo es el próximo
 * cobro y cómo pagar. Solo muestra facturas que maneja el cobro automático: las anteriores pudieron
 * pagarse por fuera sin quedar marcadas, y decirle "estás atrasado" por una de esas sería un error.
 */
export async function ownerBillingView(tenantId: string, now = new Date()) {
  if (!mongoose.isValidObjectId(tenantId)) throw new ServiceError(404, "Negocio no encontrado");
  await connectToDatabase();
  const [tenant, settings] = await Promise.all([
    Tenant.findById(tenantId).select(TENANT_FIELDS).lean() as Promise<TenantLean | null>,
    getBillingSettings(),
  ]);
  if (!tenant) throw new ServiceError(404, "Negocio no encontrado");

  const { y, m } = crDay(now);
  const next = nextPeriod(y, m);
  const nextDue = periodDueDate(next.y, next.m, BILLING_DUE_DAY);
  const b = resolveBilling(tenant.plan, billingOf(tenant), nextDue);
  const price = priceFor(tenant.plan, b, settings.prices, nextDue);

  let invoice: null | {
    period: string; amount: number; dueDate: string; status: "pending" | "late"; daysToDue: number; suspendDate: string | null;
    /** Ya está dentro de los días de aviso (o vencida): toca avisarle al dueño dentro del panel. */
    dueSoon: boolean;
  } = null;
  if (settings.enabled && settings.startPeriod && !price.free) {
    const sy = Math.floor(settings.startPeriod / 100);
    const sm = settings.startPeriod % 100;
    // Un mes con el comprobante en revisión no se le recuerda: ya pagó, falta que lo veamos.
    const open = await Payment.findOne({
      tenantId: tenant._id,
      status: { $in: ["pending", "late"] },
      "review.status": { $ne: "submitted" },
      $or: [{ periodYear: { $gt: sy } }, { periodYear: sy, periodMonth: { $gte: sm } }],
    }).sort({ dueDate: 1 }).lean() as PaymentLean | null;
    if (open) {
      const daysToDue = daysBetween(now, open.dueDate);
      invoice = {
        period: periodLabel(open.periodYear, open.periodMonth),
        amount: open.amount,
        dueDate: formatCrDate(open.dueDate),
        status: open.status === "late" ? "late" : "pending",
        daysToDue,
        dueSoon: open.status === "late" || daysToDue <= settings.reminderDays,
        suspendDate: settings.autoSuspend ? formatCrDate(addDays(open.dueDate, settings.graceDays + 1)) : null,
      };
    }
  }

  // Si la mensualidad del mes que viene ya está pagada (pagó antes del día 1), el próximo cobro es
  // el del mes siguiente.
  let upcomingDue = nextDue;
  if (!invoice && await Payment.exists({ tenantId: tenant._id, periodYear: next.y, periodMonth: next.m, status: "paid" })) {
    const after = nextPeriod(next.y, next.m);
    upcomingDue = periodDueDate(after.y, after.m, BILLING_DUE_DAY);
  }

  const pay = settings.payment;
  const hasPayment = Boolean(pay.sinpeNumber || pay.iban || pay.whatsapp || pay.notes);
  return {
    planLabel: PLAN_LABELS[tenant.plan as PlanKey] ?? tenant.plan,
    price,
    discountUntil: !price.free && price.discountAmount > 0 && b.discountUntil ? formatCrDate(b.discountUntil) : null,
    freeUntil: price.free && b.freeUntil ? formatCrDate(b.freeUntil) : null,
    nextDue: formatCrDate(upcomingDue),
    invoice,
    payment: hasPayment ? pay : null,
  };
}

// ── Resumen de plata ────────────────────────────────────────────────────────

/**
 * Cuánta plata debería entrar en un mes y cuánta entró, más lo regalado en el año.
 * Las facturas viejas (antes de los descuentos) no tienen precio de lista: vale lo que se cobró.
 */
export async function moneySummary(y: number, m: number) {
  await connectToDatabase();
  const settings = await getBillingSettings();
  const [invoices, yearRows, activeTenants] = await Promise.all([
    Payment.find({ periodYear: y, periodMonth: m, status: { $ne: "cancelled" } }).select("tenantId amount listAmount discountAmount status").lean() as unknown as PaymentLean[],
    Payment.aggregate([
      { $match: { periodYear: y, status: { $ne: "cancelled" } } },
      { $group: {
        _id: null,
        list: { $sum: { $ifNull: ["$listAmount", "$amount"] } },
        discounts: { $sum: { $cond: [{ $eq: ["$status", "cortesia"] }, 0, { $ifNull: ["$discountAmount", 0] }] } },
        courtesies: { $sum: { $cond: [{ $eq: ["$status", "cortesia"] }, { $ifNull: ["$listAmount", 0] }, 0] } },
        paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
      } },
    ]),
    Tenant.find({ status: "active" }).select(TENANT_FIELDS).lean() as unknown as Promise<TenantLean[]>,
  ]);

  const sum = (rows: PaymentLean[], f: (p: PaymentLean) => number) => rows.reduce((s, p) => s + f(p), 0);
  const courtesy = invoices.filter((p) => p.status === "cortesia");
  const charged = invoices.filter((p) => p.status !== "cortesia");
  const withInvoice = new Set(invoices.map((p) => String(p.tenantId)));
  const due = periodDueDate(y, m, BILLING_DUE_DAY);
  const missing = activeTenants.filter((t) => !withInvoice.has(String(t._id)))
    .map((t) => priceFor(t.plan, billingOf(t), settings.prices, due));

  const year = yearRows[0] ?? { list: 0, discounts: 0, courtesies: 0, paid: 0 };
  return {
    period: periodLabel(y, m),
    month: {
      list: sum(invoices, (p) => p.listAmount ?? p.amount),
      discounts: sum(charged, (p) => p.discountAmount ?? 0),
      courtesies: sum(courtesy, (p) => p.listAmount ?? 0),
      expected: sum(charged, (p) => p.amount),
      paid: sum(charged.filter((p) => p.status === "paid"), (p) => p.amount),
      pending: sum(charged.filter((p) => p.status === "pending"), (p) => p.amount),
      late: sum(charged.filter((p) => p.status === "late"), (p) => p.amount),
      invoices: invoices.length,
      courtesyCount: courtesy.length,
    },
    /** Negocios activos que todavía no tienen factura de ese mes, y lo que pagarían. */
    withoutInvoice: {
      count: missing.length,
      expected: missing.filter((p) => !isCourtesy(p)).reduce((s, p) => s + p.amount, 0),
    },
    year: { year: y, list: year.list, discounts: year.discounts, courtesies: year.courtesies, given: year.discounts + year.courtesies, paid: year.paid },
  };
}
