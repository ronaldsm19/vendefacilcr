"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, BadgePercent, CircleAlert, Clock, Gift, Send, Save, TriangleAlert } from "lucide-react";
import {
  priceFor, formatCRC, formatCrDate, toInputDate, fromInputDate, toInputMonth, fromInputMonth, periodLabel, crDay, nextPeriod,
  periodDueDate, founderSchedule, FOUNDER_PLAN, FOUNDER_STAGES,
  PLAN_LABELS, type PlanKey, type TenantBilling, type DiscountType, type PriceBreakdown,
} from "@/lib/billing";

interface Unpaid { _id: string; periodYear: number; periodMonth: number; amount: number; dueDate: string; status: string }
interface View {
  plan: string;
  billing: TenantBilling;
  prices: Record<PlanKey, number>;
  automationEnabled: boolean;
  unpaid: Unpaid[];
  /** Cupos del programa de fundadores (dato interno del superadmin). */
  founderSlots: { used: number; total: number };
}

interface Form {
  discountType: DiscountType;
  discountValue: string;
  discountUntil: string;
  discountLabel: string;
  free: boolean;
  freeUntil: string;
  freeReason: string;
  founder: boolean;
  /** AAAA-MM: el primer mes del programa (el mes sin costo). */
  founderStart: string;
}

const PREVIEW_TITLES = ["Este mes", "Mes siguiente"];

/** Primer mes sugerido: este mes si todavía va por la primera quincena, si no el siguiente. */
function defaultFounderMonth(): string {
  const { y, m, d } = crDay(new Date());
  const start = d <= 15 ? { y, m } : nextPeriod(y, m);
  return `${start.y}-${String(start.m).padStart(2, "0")}`;
}

function toForm(b: TenantBilling): Form {
  return {
    discountType: b.discountType,
    discountValue: b.discountValue ? String(b.discountValue) : "",
    discountUntil: toInputDate(b.discountUntil),
    discountLabel: b.discountLabel,
    free: b.free,
    freeUntil: toInputDate(b.freeUntil),
    freeReason: b.freeReason,
    founder: Boolean(b.founderStart),
    founderStart: toInputMonth(b.founderStart) || defaultFounderMonth(),
  };
}

function billingFromForm(f: Form): TenantBilling {
  return {
    discountType: f.discountType,
    discountValue: Number(f.discountValue) || 0,
    discountUntil: fromInputDate(f.discountUntil),
    discountLabel: f.discountLabel,
    free: f.free,
    freeUntil: fromInputDate(f.freeUntil),
    freeReason: f.freeReason,
    founderStart: f.founder ? fromInputMonth(f.founderStart) : null,
  };
}

/** Precio especial del negocio (descuento o sin costo), con vista previa y aviso de cobro manual. */
export default function TenantBillingCard({ tenantId, tenantEmail }: { tenantId: string; tenantEmail: string }) {
  const [view, setView] = useState<View | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/superadmin/tenants/${tenantId}/cobro`)
      .then((r) => r.json())
      .then((d: View) => { setView(d); setForm(toForm(d.billing)); })
      .catch(() => setMsg({ ok: false, text: "No se pudo cargar el cobro" }));
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const periods = useMemo(() => {
    const { y, m } = crDay(new Date());
    const next = nextPeriod(y, m);
    return [{ y, m }, next];
  }, []);

  if (!view || !form) {
    return (
      <section className="sa-card sa-card-pad">
        {msg && !msg.ok
          ? <p className="sa-error" role="alert">{msg.text}</p>
          : <p className="sa-muted">Cargando cobro...</p>}
      </section>
    );
  }

  const billing = billingFromForm(form);
  const previews: { label: string; price: PriceBreakdown }[] = periods.map((p) => ({
    label: periodLabel(p.y, p.m),
    price: priceFor(view.plan, billing, view.prices, periodDueDate(p.y, p.m)),
  }));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => { setForm({ ...form, [key]: value }); setMsg(null); };

  async function save() {
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/cobro`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType: form.discountType,
          discountValue: form.discountType === "none" ? 0 : Number(form.discountValue),
          discountUntil: form.discountUntil,
          discountLabel: form.discountLabel,
          free: form.free,
          freeUntil: form.freeUntil,
          freeReason: form.freeReason,
          founder: form.founder,
          founderStart: form.founderStart,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "No se pudo guardar" }); return; }
      setView(d);
      setForm(toForm(d.billing));
      setMsg({ ok: true, text: d.recalculated ? `Guardado · ${d.recalculated} factura(s) sin pagar recalculada(s)` : "Guardado" });
    } catch {
      setMsg({ ok: false, text: "Error de red al guardar" });
    } finally {
      setSaving(false);
    }
  }

  async function sendReminder() {
    const first = view?.unpaid[0];
    if (!first) return;
    if (!confirm(`¿Mandar a ${tenantEmail} el aviso de cobro de ${periodLabel(first.periodYear, first.periodMonth)} (${formatCRC(first.amount)})?`)) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/cobro/aviso`, { method: "POST" });
      const d = await res.json();
      setMsg(res.ok ? { ok: true, text: `Aviso enviado a ${d.sentTo}` } : { ok: false, text: d.error ?? "No se pudo enviar" });
    } catch {
      setMsg({ ok: false, text: "Error de red al enviar" });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="sa-card">
      <div className="sa-card-head">
        <h2 className="sa-h2">Precio y cobro</h2>
        <p className="sa-muted text-[13px]">
          Plan {PLAN_LABELS[view.plan as PlanKey] ?? view.plan} · lista{" "}
          <span className="sa-num">{formatCRC(view.prices[view.plan as PlanKey] ?? 0)}</span> al mes
        </p>
      </div>

      <div className="flex flex-col gap-5 p-5">
        {!view.automationEnabled && (
          <div className="sa-alert sa-alert-warn">
            <TriangleAlert aria-hidden />
            <span>El cobro automático está apagado: los avisos solo salen a mano.</span>
          </div>
        )}

        {/* Vista previa de lo que paga */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {previews.map(({ label, price }, i) => (
            <div key={label} className="sa-inset px-4 py-3">
              <p className="sa-stat-label">{PREVIEW_TITLES[i]} · {label}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                {price.discountAmount > 0 && (
                  <s className="sa-muted sa-num" title="Precio de lista">{formatCRC(price.listAmount)}</s>
                )}
                <span className="sa-stat-value">{price.free ? "Sin costo" : formatCRC(price.amount)}</span>
              </p>
              {price.discountLabel && (
                <p className="mt-1.5">
                  <span className="sa-chip sa-chip-info max-w-full">
                    {price.free ? <Gift aria-hidden /> : <BadgePercent aria-hidden />}
                    <span className="truncate">{price.discountLabel}</span>
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Programa Restaurantes Fundadores */}
        <FounderSection view={view} form={form} set={set} />

        {/* Descuento */}
        <fieldset disabled={form.free || form.founder} hidden={form.founder}>
          <legend className="mb-3">
            <span className="sa-eyebrow inline-flex flex-wrap items-center gap-x-2">
              <BadgePercent className="w-4 h-4" aria-hidden /> Descuento
              {form.free && <span className="font-normal">(no aplica mientras sea sin costo)</span>}
            </span>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sa-field">
              <span className="sa-label">Tipo</span>
              <select value={form.discountType} onChange={(e) => set("discountType", e.target.value as DiscountType)} className="sa-input">
                <option value="none">Sin descuento</option>
                <option value="percent">Porcentaje</option>
                <option value="amount">Monto fijo</option>
              </select>
            </label>
            {form.discountType !== "none" && (
              <label className="sa-field">
                <span className="sa-label">{form.discountType === "percent" ? "Porcentaje (1–100)" : "Monto a rebajar (₡)"}</span>
                <input type="number" min={1} inputMode="numeric" value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} className="sa-input sa-num" />
              </label>
            )}
            {form.discountType !== "none" && (
              <>
                <label className="sa-field">
                  <span className="sa-label">Etiqueta (la ve el dueño)</span>
                  <input value={form.discountLabel} maxLength={60} placeholder="Cliente fundador" onChange={(e) => set("discountLabel", e.target.value)} className="sa-input" />
                </label>
                <label className="sa-field">
                  <span className="sa-label">Hasta (vacío = sin fecha de fin)</span>
                  <input type="date" value={form.discountUntil} onChange={(e) => set("discountUntil", e.target.value)} className="sa-input" />
                </label>
              </>
            )}
          </div>
        </fieldset>

        {/* Sin costo */}
        <div className="flex flex-col gap-3" hidden={form.founder}>
          <label className="sa-check">
            <input type="checkbox" checked={form.free} onChange={(e) => set("free", e.target.checked)} />
            <span className="inline-flex items-center gap-1.5">
              <Gift className="w-4 h-4" aria-hidden /> Sin costo (cortesía)
            </span>
          </label>
          {form.free && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sa-field">
                <span className="sa-label">Motivo</span>
                <input value={form.freeReason} maxLength={60} placeholder="Prueba 30 días" onChange={(e) => set("freeReason", e.target.value)} className="sa-input" />
              </label>
              <label className="sa-field">
                <span className="sa-label">Hasta (vacío = indefinido)</span>
                <input type="date" value={form.freeUntil} onChange={(e) => set("freeUntil", e.target.value)} className="sa-input" />
              </label>
              <p className="sa-help sm:col-span-2">
                Sin facturas, recordatorios ni suspensión por pago. Si tiene fecha de fin, 7 días antes le llega un aviso con lo que va a pagar.
              </p>
            </div>
          )}
        </div>

        {/* Sin pagar */}
        {view.unpaid.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="sa-eyebrow">Sin pagar</p>
            <ul className="sa-inset sa-divide">
              {view.unpaid.map((u) => (
                <li key={u._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="sa-strong capitalize">{periodLabel(u.periodYear, u.periodMonth)}</span>
                  <span className="sa-muted sa-num text-[13px]">vence {formatCrDate(u.dueDate)}</span>
                  {u.status === "late" ? (
                    <span className="sa-chip sa-chip-danger"><CircleAlert aria-hidden />Atrasado</span>
                  ) : (
                    <span className="sa-chip sa-chip-warn"><Clock aria-hidden />Pendiente</span>
                  )}
                  <span className="sa-strong sa-num ml-auto">{formatCRC(u.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving} className="sa-btn sa-btn-primary">
            <Save className="w-4 h-4" aria-hidden /> {saving ? "Guardando..." : "Guardar precio"}
          </button>
          {view.unpaid.length > 0 && previews[0].price.amount > 0 && (
            <button type="button" onClick={() => void sendReminder()} disabled={sending} className="sa-btn sa-btn-secondary">
              <Send className="w-4 h-4" aria-hidden /> {sending ? "Enviando..." : "Enviar aviso de cobro"}
            </button>
          )}
          {msg && <p className={msg.ok ? "sa-success" : "sa-error"} role="status">{msg.text}</p>}
        </div>
      </div>
    </section>
  );
}

/**
 * El programa Restaurantes Fundadores: un mes sin costo, tres al 50% y el 20% para siempre, solo en
 * Premium. El sistema cambia de etapa solo; acá se elige el primer mes y se ven los cupos.
 */
function FounderSection({ view, form, set }: {
  view: View;
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
}) {
  const wasFounder = Boolean(view.billing.founderStart);
  const isPremium = view.plan === FOUNDER_PLAN;
  const full = !wasFounder && view.founderSlots.used >= view.founderSlots.total;
  const start = fromInputMonth(form.founderStart);
  const plan = start ? founderSchedule(start) : null;
  const { halfPercent, foreverPercent } = FOUNDER_STAGES;

  return (
    <div className="flex flex-col gap-3">
      <label className="sa-check">
        <input
          type="checkbox"
          checked={form.founder}
          disabled={!form.founder && (!isPremium || full)}
          onChange={(e) => set("founder", e.target.checked)}
        />
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><Award className="w-4 h-4" aria-hidden /> Restaurante fundador</span>
          <span className="sa-muted text-[13px]">
            {view.founderSlots.used} de {view.founderSlots.total} cupos usados
          </span>
        </span>
      </label>
      {!form.founder && !isPremium && <p className="sa-help">Solo para negocios en el plan Premium.</p>}
      {!form.founder && isPremium && full && <p className="sa-help">Ya se usaron todos los cupos del programa.</p>}
      {form.founder && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sa-field">
            <span className="sa-label">Primer mes (sin costo)</span>
            <input type="month" value={form.founderStart} onChange={(e) => set("founderStart", e.target.value)} className="sa-input" />
          </label>
          {plan && (
            <ul className="sa-inset flex flex-col gap-1 px-4 py-3 text-[13px]" aria-label="Calendario del programa">
              <li><span className="sa-strong capitalize">{plan.free}</span>: sin costo</li>
              <li><span className="sa-strong capitalize">{plan.halfFrom}</span> a <span className="sa-strong">{plan.halfTo}</span>: {halfPercent}% de descuento</li>
              <li>Desde <span className="sa-strong">{plan.foreverFrom}</span>: {foreverPercent}% para siempre</li>
            </ul>
          )}
          <p className="sa-help sm:col-span-2">
            El sistema cambia de etapa solo, mes a mes. Si el negocio deja el plan Premium, paga el precio de lista de su plan;
            al quitarlo del programa, el cupo queda libre. El descuento o la cortesía manuales no aplican mientras esté en el programa.
          </p>
        </div>
      )}
    </div>
  );
}
