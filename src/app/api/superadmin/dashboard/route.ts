import { NextRequest, NextResponse } from "next/server";
import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getSuperadminSession } from "@/lib/auth";
import { Tenant } from "@/models/Tenant";
import { Payment } from "@/models/Payment";
import { TenantRequest } from "@/models/TenantRequest";
import { ErrorEvent } from "@/models/ErrorEvent";
import { AccessLog } from "@/models/AccessLog";
import { BILLING_DUE_DAY } from "@/models/BillingSettings";
import { getBillingSettings, moneySummary } from "@/server/services/billing";
import {
  PLAN_LABELS, billingOf, priceFor, crDay, nextPeriod, periodDueDate, formatCrDate, formatCRC, daysBetween,
  type PlanKey, type TenantBilling,
} from "@/lib/billing";

/**
 * Dashboard del superadmin ("Qué atender hoy"): la plata del mes, lo que pide atención y el estado
 * de cobro de cada negocio. Los días se cuentan en hora de Costa Rica.
 */

type BillingState = "suspendido" | "gratis" | "atrasado" | "vence" | "aldia";
type TodayKind = "late" | "dueSoon" | "suspended" | "request" | "errors";

interface TodayItem { kind: TodayKind; title: string; detail: string; href: string }
/** Un pendiente con su orden dentro de su grupo (menor = más urgente). */
interface Ranked { order: number; item: TodayItem }

interface TenantDoc {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  plan: string;
  status: string;
  suspendedReason?: string;
  suspendedAt?: Date | null;
  billing?: Partial<TenantBilling> | null;
}
interface InvoiceDoc { tenantId: Types.ObjectId; amount: number; status: "pending" | "late"; dueDate: Date }
interface RequestDoc { businessName: string; plan: string; createdAt: Date }

const TODAY_MAX = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** De más a menos urgente, para ordenar la tabla de negocios. */
const STATE_ORDER: Record<BillingState, number> = { atrasado: 0, vence: 1, suspendido: 2, aldia: 3, gratis: 4 };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const sumAmounts = (rows: InvoiceDoc[]) => rows.reduce((s, p) => s + p.amount, 0);
const byOrder = (list: Ranked[]) => list.sort((a, b) => a.order - b.order).map((x) => x.item);

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const now = new Date();
  const { y, m } = crDay(now);
  const next = nextPeriod(y, m);

  // moneySummary vuelve a leer la configuración: espera a la primera lectura para que, en una base
  // recién creada, no intenten crearla las dos a la vez. Lo demás corre en paralelo.
  const settingsQuery = getBillingSettings();
  const [settings, summary, tenants, openInvoices, requests, pendingRequests, errorTotals, lastLogins] = await Promise.all([
    settingsQuery,
    settingsQuery.then(() => moneySummary(y, m)),
    Tenant.find().select("_id slug name plan status suspendedReason suspendedAt billing").lean() as unknown as Promise<TenantDoc[]>,
    // Todas las facturas sin pagar, de la que venció primero a la que vence último.
    Payment.find({ status: { $in: ["pending", "late"] } }).select("tenantId amount status dueDate").sort({ dueDate: 1 }).lean() as unknown as Promise<InvoiceDoc[]>,
    TenantRequest.find({ status: "pending" }).select("businessName plan createdAt").sort({ createdAt: 1 }).limit(TODAY_MAX).lean() as unknown as Promise<RequestDoc[]>,
    TenantRequest.countDocuments({ status: "pending" }) as unknown as Promise<number>,
    ErrorEvent.aggregate([
      { $match: { level: "error", lastAt: { $gte: new Date(now.getTime() - DAY_MS) } } },
      { $group: { _id: null, total: { $sum: "$count" }, tenants: { $addToSet: "$tenantId" } } },
    ]) as unknown as Promise<{ total: number; tenants: (Types.ObjectId | null)[] }[]>,
    // Último ingreso al panel de cada negocio. AccessLog también guarda visitas a la tienda y otros
    // eventos: solo cuenta event "login" (los registros de antes de que existiera el campo no lo
    // tienen; "login" es su valor por defecto).
    AccessLog.aggregate([
      { $match: { success: true, event: { $in: ["login", null] } } },
      { $group: { _id: "$tenantId", lastAt: { $max: "$createdAt" } } },
    ]) as unknown as Promise<{ _id: Types.ObjectId; lastAt: Date }[]>,
  ]);

  const invoicesOf = new Map<string, InvoiceDoc[]>();
  for (const inv of openInvoices) {
    const key = String(inv.tenantId);
    const list = invoicesOf.get(key);
    if (list) list.push(inv);
    else invoicesOf.set(key, [inv]);
  }
  const lastLoginOf = new Map(lastLogins.map((r) => [String(r._id), r.lastAt]));

  const monthDue = periodDueDate(y, m, BILLING_DUE_DAY);
  const nextMonthDue = formatCrDate(periodDueDate(next.y, next.m, BILLING_DUE_DAY));

  const todayLate: Ranked[] = [];
  const todayDueSoon: Ranked[] = [];
  const todaySuspended: Ranked[] = [];

  const rows = tenants.map((t) => {
    const id = String(t._id);
    const href = `/superadmin/tenants/${id}`;
    const price = priceFor(t.plan, billingOf(t), settings.prices, monthDue);
    // Igual que el cobro automático: un descuento que deja la mensualidad en ₡0 también es sin costo.
    const free = price.free || price.amount === 0;

    const open = invoicesOf.get(id) ?? [];
    const overdue = open.filter((p) => daysBetween(now, p.dueDate) < 0);
    const dueSoon = open.filter((p) => {
      const days = daysBetween(now, p.dueDate);
      return p.status === "pending" && days >= 0 && days <= settings.reminderDays;
    });

    const billingState: BillingState =
      t.status !== "active" ? "suspendido"
      : free ? "gratis"
      : overdue.length ? "atrasado"
      : dueSoon.length ? "vence"
      : "aldia";

    if (billingState === "atrasado") {
      const days = daysBetween(overdue[0].dueDate, now);
      const invoices = overdue.length > 1 ? ` en ${overdue.length} facturas` : "";
      todayLate.push({
        order: -days,
        item: { kind: "late", title: t.name, href, detail: `Lleva ${count(days, "día", "días")} de atraso: ${formatCRC(sumAmounts(overdue))}${invoices}` },
      });
    } else if (billingState === "vence") {
      const days = daysBetween(now, dueSoon[0].dueDate);
      const when = days === 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : `Vence en ${days} días`;
      todayDueSoon.push({
        order: days,
        item: { kind: "dueSoon", title: t.name, href, detail: `${when}: ${formatCRC(dueSoon[0].amount)}` },
      });
    } else if (t.status === "suspended" && t.suspendedReason === "falta_pago") {
      // Los suspendidos por otro motivo no son un pendiente del día: no hay nada que cobrarles.
      const since = t.suspendedAt ? ` desde el ${formatCrDate(t.suspendedAt)}` : "";
      const debt = sumAmounts(open);
      todaySuspended.push({
        order: -(t.suspendedAt ? new Date(t.suspendedAt).getTime() : 0),
        item: { kind: "suspended", title: t.name, href, detail: `Suspendido por falta de pago${since}${debt > 0 ? `; debe ${formatCRC(debt)}` : ""}` },
      });
    }

    const lastLogin = lastLoginOf.get(id);
    return {
      // Para ordenar dentro de un mismo estado: primero el que venció (o vence) antes.
      due: billingState === "atrasado" ? overdue[0].dueDate.getTime() : billingState === "vence" ? dueSoon[0].dueDate.getTime() : 0,
      row: {
        id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        status: t.status,
        suspendedReason: t.suspendedReason ?? "",
        billingState,
        amount: price.amount,
        listAmount: price.listAmount,
        discountLabel: price.discountLabel,
        free,
        nextDue: billingState === "suspendido" || billingState === "gratis" ? null
          : open.length ? formatCrDate(open[0].dueDate)
          : nextMonthDue,
        lastAccessAt: lastLogin ? new Date(lastLogin).toISOString() : null,
      },
    };
  })
    .sort((a, b) =>
      STATE_ORDER[a.row.billingState] - STATE_ORDER[b.row.billingState]
      || a.due - b.due
      || a.row.name.localeCompare(b.row.name, "es"))
    .map((x) => x.row);

  const inState = (state: BillingState) => rows.filter((r) => r.billingState === state).length;
  const errors24h = errorTotals[0]?.total ?? 0;
  const errorTenants = (errorTotals[0]?.tenants ?? []).filter(Boolean).length;

  // Lo más urgente primero: plata atrasada, cobros por vencer, solicitudes y errores sin revisar y,
  // al final, los suspendidos por falta de pago (ya están frenados; solo falta que paguen).
  const today: TodayItem[] = [
    ...byOrder(todayLate),
    ...byOrder(todayDueSoon),
    ...requests.map((r): TodayItem => ({
      kind: "request",
      title: r.businessName,
      detail: `Pidió el plan ${PLAN_LABELS[r.plan as PlanKey] ?? r.plan} el ${formatCrDate(r.createdAt)}`,
      href: "/superadmin/solicitudes",
    })),
    ...(errors24h > 0 ? [{
      kind: "errors",
      title: `${count(errors24h, "error", "errores")} en las últimas 24 h`,
      detail: errorTenants > 0 ? `En ${count(errorTenants, "negocio", "negocios")}` : "Sin negocio asociado",
      href: "/superadmin/errores",
    } satisfies TodayItem] : []),
    ...byOrder(todaySuspended),
  ].slice(0, TODAY_MAX);

  return NextResponse.json({
    period: summary.period,
    month: {
      expected: summary.month.expected,
      paid: summary.month.paid,
      pending: summary.month.pending,
      late: summary.month.late,
      withoutInvoiceCount: summary.withoutInvoice.count,
      withoutInvoiceExpected: summary.withoutInvoice.expected,
    },
    attention: {
      dueSoon: inState("vence"),
      late: inState("atrasado"),
      suspended: inState("suspendido"),
      pendingRequests,
      errors24h,
    },
    today,
    tenants: rows,
    automation: {
      enabled: settings.enabled,
      cronConfigured: Boolean(process.env.CRON_SECRET),
      lastRunAt: settings.lastRunAt,
      lastRunSummary: settings.lastRunSummary,
      lastRunError: settings.lastRunError,
    },
  });
}
