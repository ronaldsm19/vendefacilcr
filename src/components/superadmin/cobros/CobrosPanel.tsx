"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Eye, Save, AlertTriangle } from "lucide-react";
import { formatCRC, periodLabel, crDay, nextPeriod, MONTH_NAMES, PLAN_KEYS, PLAN_LABELS, type PlanKey } from "@/lib/billing";

interface Settings {
  enabled: boolean;
  startPeriod: number | null;
  prices: Record<PlanKey, number>;
  reminderDays: number;
  graceDays: number;
  autoSuspend: boolean;
  payment: { sinpeNumber: string; sinpeName: string; iban: string; ibanName: string; whatsapp: string; notes: string };
  lastRunAt: string | null;
  lastRunSummary: string;
  lastRunError: string;
  updatedBy: string;
}
interface Summary {
  period: string;
  month: { list: number; discounts: number; courtesies: number; expected: number; paid: number; pending: number; late: number; invoices: number; courtesyCount: number };
  withoutInvoice: { count: number; expected: number };
  year: { year: number; given: number; paid: number; discounts: number; courtesies: number };
}
interface Action { type: string; tenantSlug: string; tenantName: string; detail: string; emailError?: string }
interface RunResult {
  dryRun: boolean;
  enabled: boolean;
  startPeriod: number;
  actions: Action[];
  summary: string;
  upcoming: { period: string; reminderDate: string; dueDate: string; suspendDate: string | null; tenants: number; expected: number; courtesies: number };
}

type Form = Omit<Settings, "prices" | "reminderDays" | "graceDays" | "lastRunAt" | "lastRunSummary" | "lastRunError" | "updatedBy" | "startPeriod"> & {
  prices: Record<PlanKey, string>;
  reminderDays: string;
  graceDays: string;
};

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" };
const SELECT = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
const ACTION_LABELS: Record<string, string> = {
  factura: "Factura", cortesia: "Cortesía", recordatorio: "Recordatorio", vence_hoy: "Vence hoy",
  vencida: "Vencida", atrasada: "Atrasada", suspension: "Suspensión", fin_gratis: "Fin de cortesía",
};
const ACTION_COLORS: Record<string, string> = {
  suspension: "text-red-300", atrasada: "text-red-300/80", vencida: "text-amber-300", vence_hoy: "text-amber-300",
  recordatorio: "text-blue-300", factura: "text-white/70", cortesia: "text-emerald-300/80", fin_gratis: "text-emerald-300/80",
};

const periodOf = (key: number) => periodLabel(Math.floor(key / 100), key % 100);

function toForm(s: Settings): Form {
  return {
    enabled: s.enabled, autoSuspend: s.autoSuspend, payment: { ...s.payment },
    prices: { emprende: String(s.prices.emprende), pro: String(s.prices.pro), premium: String(s.prices.premium) },
    reminderDays: String(s.reminderDays), graceDays: String(s.graceDays),
  };
}

export default function CobrosPanel() {
  const today = crDay(new Date());
  const [year, setYear] = useState(today.y);
  const [month, setMonth] = useState(today.m);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cronConfigured, setCronConfigured] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [running, setRunning] = useState<"preview" | "real" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/superadmin/cobros?year=${year}&month=${month}`);
    if (!res.ok) return;
    const d = await res.json();
    setSettings(d.settings);
    setSummary(d.summary);
    setCronConfigured(d.cronConfigured);
    setForm((f) => f ?? toForm(d.settings));
  }, [year, month]);

  const execute = useCallback(async (dryRun: boolean) => {
    setRunning(dryRun ? "preview" : "real");
    try {
      const res = await fetch("/api/superadmin/cobros/ejecutar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }),
      });
      if (res.ok) setRun(await res.json());
    } finally {
      setRunning(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void execute(true); }, [execute]);

  async function save() {
    if (!form || !settings) return;
    if (form.enabled && !settings.enabled) {
      const next = nextPeriod(today.y, today.m);
      if (!confirm(`¿Encender el cobro automático? Va a manejar las facturas desde ${periodLabel(next.y, next.m)}: crearlas, mandar los avisos${form.autoSuspend ? " y suspender a quien no pague" : ""}. Las facturas anteriores no disparan nada.`)) return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/superadmin/cobros", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled, autoSuspend: form.autoSuspend,
          reminderDays: Number(form.reminderDays), graceDays: Number(form.graceDays),
          prices: Object.fromEntries(PLAN_KEYS.map((p) => [p, Number(form.prices[p])])),
          payment: form.payment,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setSaveMsg({ ok: false, text: d.error ?? "No se pudo guardar" }); return; }
      setSettings(d.settings);
      setForm(toForm(d.settings));
      setSaveMsg({ ok: true, text: "Guardado" });
      void load();
      void execute(true);
    } catch {
      setSaveMsg({ ok: false, text: "Error de red al guardar" });
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!confirm("¿Correr el cobro automático ahora? Hace lo mismo que la corrida diaria: crea facturas, manda avisos y suspende si corresponde.")) return;
    await execute(false);
    void load();
  }

  if (!settings || !summary || !form) {
    return <div className="p-8 text-white/30 text-sm">Cargando...</div>;
  }

  const s = summary.month;
  const setPay = (key: keyof Form["payment"], value: string) => { setForm({ ...form, payment: { ...form.payment, [key]: value } }); setSaveMsg(null); };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Cobros</h1>
        <p className="text-white/40 text-sm mt-1">Mensualidades, descuentos, cortesías y el cobro automático.</p>
      </div>

      {/* Resumen de plata */}
      <section className="rounded-2xl p-6 space-y-5" style={CARD} aria-labelledby="resumen-title">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 id="resumen-title" className="text-white/70 font-semibold text-sm uppercase tracking-wide">Plata del mes</h2>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="cobros-mes">Mes</label>
            <select id="cobros-mes" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-xl px-3 py-2 text-sm text-white/70 cursor-pointer capitalize" style={SELECT}>
              {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
            <label className="sr-only" htmlFor="cobros-anio">Año</label>
            <select id="cobros-anio" value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-xl px-3 py-2 text-sm text-white/70 cursor-pointer" style={SELECT}>
              {[today.y - 1, today.y, today.y + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <dl className="text-sm divide-y divide-white/5">
            <Row label={`Valor de lista (${s.invoices} factura${s.invoices === 1 ? "" : "s"})`} value={formatCRC(s.list)} />
            <Row label="− Descuentos" value={`−${formatCRC(s.discounts)}`} muted />
            <Row label={`− Cortesías (${s.courtesyCount})`} value={`−${formatCRC(s.courtesies)}`} muted />
            <Row label="Lo que deberías recibir" value={formatCRC(s.expected)} strong />
          </dl>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Cobrado" value={formatCRC(s.paid)} className="text-emerald-300" />
              <Stat label="Pendiente" value={formatCRC(s.pending)} className="text-amber-300" />
              <Stat label="Atrasado" value={formatCRC(s.late)} className="text-red-300" />
            </div>
            {summary.withoutInvoice.count > 0 && (
              <p className="text-xs text-white/40">
                {summary.withoutInvoice.count} negocio(s) activo(s) todavía sin factura de este mes ({formatCRC(summary.withoutInvoice.expected)}).
              </p>
            )}
            <p className="text-xs text-white/40">
              En {summary.year.year}: regalaste {formatCRC(summary.year.given)} (descuentos {formatCRC(summary.year.discounts)} · cortesías {formatCRC(summary.year.courtesies)}) y cobraste {formatCRC(summary.year.paid)}.
            </p>
          </div>
        </div>
      </section>

      {/* Cobro automático */}
      <section className="rounded-2xl p-6 space-y-4" style={CARD} aria-labelledby="auto-title">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 id="auto-title" className="text-white/70 font-semibold text-sm uppercase tracking-wide">Cobro automático</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"}`}>
            {settings.enabled ? "Encendido" : "Apagado"}
          </span>
        </div>
        {settings.enabled && settings.startPeriod && (
          <p className="text-sm text-white/50">Maneja las facturas desde {periodOf(settings.startPeriod)}. Las anteriores no disparan avisos ni suspensiones.</p>
        )}
        {!cronConfigured && (
          <p className="flex items-start gap-2 text-sm text-amber-300/90">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            Falta la variable CRON_SECRET en Vercel: la corrida diaria no va a correr sola. Mientras tanto se puede correr a mano.
          </p>
        )}
        {run && (
          <p className="text-sm text-white/60">
            Próximo cobro: <strong className="text-white/80 capitalize">{run.upcoming.period}</strong> · aviso el {run.upcoming.reminderDate} · vence el {run.upcoming.dueDate}
            {run.upcoming.suspendDate && <> · suspensión el {run.upcoming.suspendDate}</>} · {run.upcoming.tenants} negocio(s) pagan {formatCRC(run.upcoming.expected)}
            {run.upcoming.courtesies > 0 && <> · {run.upcoming.courtesies} cortesía(s)</>}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={() => void execute(true)} disabled={running !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white disabled:opacity-40 cursor-pointer"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Eye className="w-4 h-4" aria-hidden /> {running === "preview" ? "Revisando..." : "Ver qué haría hoy"}
          </button>
          <button
            type="button" onClick={() => void runNow()} disabled={running !== null || !settings.enabled}
            title={settings.enabled ? undefined : "Encendé el cobro automático para correrlo"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl saas-accent-bg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <Play className="w-4 h-4" aria-hidden /> {running === "real" ? "Corriendo..." : "Correr ahora"}
          </button>
        </div>

        {run && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-xs text-white/40">{run.dryRun ? "Vista previa (no cambió nada)" : "Corrida"} · {run.summary}</p>
            {run.actions.length > 0 && (
              <ul className="space-y-1 text-sm">
                {run.actions.map((a, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3">
                    <span className={`font-medium ${ACTION_COLORS[a.type] ?? "text-white/70"}`}>{ACTION_LABELS[a.type] ?? a.type}</span>
                    <span className="text-white/80">{a.tenantName}</span>
                    <span className="text-white/40">{a.detail}</span>
                    {a.emailError && <span className="text-red-300 text-xs">correo sin enviar: {a.emailError}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {settings.lastRunAt && (
          <p className="text-xs text-white/35">
            Última corrida: {new Date(settings.lastRunAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })} · {settings.lastRunSummary}
            {settings.lastRunError && <span className="text-red-300"> · {settings.lastRunError}</span>}
          </p>
        )}
      </section>

      {/* Configuración */}
      <section className="rounded-2xl p-6 space-y-5" style={CARD} aria-labelledby="config-title">
        <h2 id="config-title" className="text-white/70 font-semibold text-sm uppercase tracking-wide">Configuración</h2>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => { setForm({ ...form, enabled: e.target.checked }); setSaveMsg(null); }} className="w-4 h-4 accent-emerald-500" />
            Cobro automático encendido
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input type="checkbox" checked={form.autoSuspend} onChange={(e) => { setForm({ ...form, autoSuspend: e.target.checked }); setSaveMsg(null); }} className="w-4 h-4 accent-emerald-500" />
            Suspender automáticamente al pasar los días de gracia
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <NumberField label="Días de aviso" value={form.reminderDays} onChange={(v) => setForm({ ...form, reminderDays: v })} />
          <NumberField label="Días de gracia" value={form.graceDays} onChange={(v) => setForm({ ...form, graceDays: v })} />
          {PLAN_KEYS.map((p) => (
            <NumberField key={p} label={`Precio ${PLAN_LABELS[p]} (₡)`} value={form.prices[p]} onChange={(v) => setForm({ ...form, prices: { ...form.prices, [p]: v } })} />
          ))}
        </div>
        <p className="text-xs text-white/35">
          Se cobra el día 1. Con {form.reminderDays || "?"} días de aviso y {form.graceDays || "?"} de gracia: el recordatorio sale {form.reminderDays || "?"} días antes, otro aviso el día 1
          {form.autoSuspend ? `, y si no paga se suspende el día ${Number(form.graceDays) + 2 || "?"}` : ""}. Un precio nuevo aplica a las facturas siguientes.
        </p>

        <div className="space-y-3">
          <p className="text-sm text-white/70">Cómo pagar <span className="text-white/35 text-xs">(sale en los correos de cobro)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="SINPE Móvil" value={form.payment.sinpeNumber} placeholder="8888-8888" onChange={(v) => setPay("sinpeNumber", v)} />
            <TextField label="A nombre de" value={form.payment.sinpeName} onChange={(v) => setPay("sinpeName", v)} />
            <TextField label="IBAN" value={form.payment.iban} placeholder="CR00 0000 0000 0000 0000 00" onChange={(v) => setPay("iban", v)} />
            <TextField label="Titular de la cuenta" value={form.payment.ibanName} onChange={(v) => setPay("ibanName", v)} />
            <TextField label="WhatsApp para comprobantes" value={form.payment.whatsapp} placeholder="50688888888" onChange={(v) => setPay("whatsapp", v)} />
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs text-white/50">Indicaciones (opcional)</span>
            <textarea rows={2} maxLength={300} value={form.payment.notes} onChange={(e) => setPay("notes", e.target.value)} className="saas-input resize-none" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" onClick={() => void save()} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl saas-accent-bg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden /> {saving ? "Guardando..." : "Guardar configuración"}
          </button>
          {saveMsg && <p className={`text-sm ${saveMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{saveMsg.text}</p>}
          {settings.updatedBy && <p className="text-xs text-white/30">Último cambio: {settings.updatedBy}</p>}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className={muted ? "text-white/45" : strong ? "text-white font-semibold" : "text-white/70"}>{label}</dt>
      <dd className={`tabular-nums ${muted ? "text-white/45" : strong ? "text-white font-semibold text-base" : "text-white/80"}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
      <p className="text-xs text-white/40">{label}</p>
      <p className={`text-base font-semibold tabular-nums mt-0.5 ${className}`}>{value}</p>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-white/50">{label}</span>
      <input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className="saas-input tabular-nums" />
    </label>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-white/50">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="saas-input" />
    </label>
  );
}
