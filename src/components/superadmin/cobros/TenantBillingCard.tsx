"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Gift, Send, Save } from "lucide-react";
import {
  priceFor, formatCRC, formatCrDate, toInputDate, fromInputDate, periodLabel, crDay, nextPeriod, periodDueDate,
  PLAN_LABELS, type PlanKey, type TenantBilling, type DiscountType, type PriceBreakdown,
} from "@/lib/billing";

interface Unpaid { _id: string; periodYear: number; periodMonth: number; amount: number; dueDate: string; status: string }
interface View {
  plan: string;
  billing: TenantBilling;
  prices: Record<PlanKey, number>;
  automationEnabled: boolean;
  unpaid: Unpaid[];
}

interface Form {
  discountType: DiscountType;
  discountValue: string;
  discountUntil: string;
  discountLabel: string;
  free: boolean;
  freeUntil: string;
  freeReason: string;
}

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" };

function toForm(b: TenantBilling): Form {
  return {
    discountType: b.discountType,
    discountValue: b.discountValue ? String(b.discountValue) : "",
    discountUntil: toInputDate(b.discountUntil),
    discountLabel: b.discountLabel,
    free: b.free,
    freeUntil: toInputDate(b.freeUntil),
    freeReason: b.freeReason,
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
    return <div className="rounded-2xl p-6 text-sm text-white/30" style={CARD}>Cargando cobro...</div>;
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
    <div className="rounded-2xl p-6 space-y-5" style={CARD}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white/70 font-semibold text-sm uppercase tracking-wide">Precio y cobro</h2>
          <p className="text-white/40 text-xs mt-1">
            Plan {PLAN_LABELS[view.plan as PlanKey] ?? view.plan} · lista {formatCRC(view.prices[view.plan as PlanKey] ?? 0)} al mes
          </p>
        </div>
        {!view.automationEnabled && (
          <span className="text-xs text-amber-300/80">El cobro automático está apagado: los avisos solo salen a mano.</span>
        )}
      </div>

      {/* Vista previa de lo que paga */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {previews.map(({ label, price }) => (
          <div key={label} className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-xs text-white/40 capitalize">{label}</p>
            <p className="mt-1 flex items-baseline gap-2 flex-wrap">
              {price.discountAmount > 0 && <span className="text-sm text-white/35 line-through tabular-nums">{formatCRC(price.listAmount)}</span>}
              <span className="text-lg font-semibold text-white tabular-nums">{price.free ? "Sin costo" : formatCRC(price.amount)}</span>
            </p>
            {price.discountLabel && <p className="text-xs text-emerald-300/80 mt-0.5">{price.discountLabel}</p>}
          </div>
        ))}
      </div>

      {/* Descuento */}
      <fieldset className="space-y-3" disabled={form.free}>
        <legend className="flex items-center gap-2 text-sm text-white/70 mb-1">
          <BadgePercent className="w-4 h-4" aria-hidden /> Descuento {form.free && <span className="text-xs text-white/35">(no aplica mientras sea sin costo)</span>}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-white/50">Tipo</span>
            <select value={form.discountType} onChange={(e) => set("discountType", e.target.value as DiscountType)} className="saas-input cursor-pointer">
              <option value="none">Sin descuento</option>
              <option value="percent">Porcentaje</option>
              <option value="amount">Monto fijo</option>
            </select>
          </label>
          {form.discountType !== "none" && (
            <label className="block space-y-1.5">
              <span className="text-xs text-white/50">{form.discountType === "percent" ? "Porcentaje (1–100)" : "Monto a rebajar (₡)"}</span>
              <input type="number" min={1} inputMode="numeric" value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} className="saas-input tabular-nums" />
            </label>
          )}
          {form.discountType !== "none" && (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs text-white/50">Etiqueta (la ve el dueño)</span>
                <input value={form.discountLabel} maxLength={60} placeholder="Cliente fundador" onChange={(e) => set("discountLabel", e.target.value)} className="saas-input" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-white/50">Hasta (vacío = sin fecha de fin)</span>
                <input type="date" value={form.discountUntil} onChange={(e) => set("discountUntil", e.target.value)} className="saas-input" />
              </label>
            </>
          )}
        </div>
      </fieldset>

      {/* Sin costo */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input type="checkbox" checked={form.free} onChange={(e) => set("free", e.target.checked)} className="w-4 h-4 accent-emerald-500" />
          <Gift className="w-4 h-4" aria-hidden /> Sin costo (cortesía)
        </label>
        {form.free && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-white/50">Motivo</span>
              <input value={form.freeReason} maxLength={60} placeholder="Prueba 30 días" onChange={(e) => set("freeReason", e.target.value)} className="saas-input" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-white/50">Hasta (vacío = indefinido)</span>
              <input type="date" value={form.freeUntil} onChange={(e) => set("freeUntil", e.target.value)} className="saas-input" />
            </label>
            <p className="sm:col-span-2 text-xs text-white/35">
              Sin facturas, recordatorios ni suspensión por pago. Si tiene fecha de fin, 7 días antes le llega un aviso con lo que va a pagar.
            </p>
          </div>
        )}
      </div>

      {/* Sin pagar */}
      {view.unpaid.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/50">Sin pagar</p>
          <ul className="space-y-1">
            {view.unpaid.map((u) => (
              <li key={u._id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/70 capitalize">{periodLabel(u.periodYear, u.periodMonth)}</span>
                <span className="text-white/40 text-xs">vence {formatCrDate(u.dueDate)}</span>
                <span className={`tabular-nums font-medium ${u.status === "late" ? "text-red-300" : "text-amber-300"}`}>{formatCRC(u.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={() => void save()} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl saas-accent-bg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" aria-hidden /> {saving ? "Guardando..." : "Guardar precio"}
        </button>
        {view.unpaid.length > 0 && !form.free && (
          <button
            type="button" onClick={() => void sendReminder()} disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white disabled:opacity-40 cursor-pointer"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Send className="w-4 h-4" aria-hidden /> {sending ? "Enviando..." : "Enviar aviso de cobro"}
          </button>
        )}
        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
