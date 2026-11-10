"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Ban, Bell, CalendarX, CircleAlert, Clock, Eye, FileText, Gift, Play, Power, PowerOff, Save,
  type LucideIcon,
} from "lucide-react";
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

const ACTION_LABELS: Record<string, string> = {
  factura: "Factura", cortesia: "Cortesía", recordatorio: "Recordatorio", vence_hoy: "Vence hoy",
  vencida: "Vencida", atrasada: "Atrasada", suspension: "Suspensión", fin_gratis: "Fin de cortesía",
};
// Chip de cada acción de la corrida: el tono dice qué tan grave es y el ícono evita depender del color.
const ACTION_CHIPS: Record<string, { tone: string; Icon: LucideIcon }> = {
  factura: { tone: "", Icon: FileText },
  cortesia: { tone: "sa-chip-info", Icon: Gift },
  fin_gratis: { tone: "sa-chip-info", Icon: CalendarX },
  recordatorio: { tone: "sa-chip-info", Icon: Bell },
  vence_hoy: { tone: "sa-chip-warn", Icon: Clock },
  vencida: { tone: "sa-chip-warn", Icon: AlertTriangle },
  atrasada: { tone: "sa-chip-danger", Icon: CircleAlert },
  suspension: { tone: "sa-chip-danger", Icon: Ban },
};
const TONE_TEXT = { ok: "sa-ok-text", warn: "sa-warn-text", danger: "sa-danger-text" } as const;

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
    return (
      <div className="sa-page">
        <p className="sa-muted">Cargando...</p>
      </div>
    );
  }

  const s = summary.month;
  const setPay = (key: keyof Form["payment"], value: string) => { setForm({ ...form, payment: { ...form.payment, [key]: value } }); setSaveMsg(null); };

  return (
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Cobros</h1>
          <p className="sa-subtitle">Mensualidades, descuentos, cortesías y el cobro automático.</p>
        </div>
      </header>

      {/* Resumen de plata */}
      <section className="sa-card sa-card-raised" aria-labelledby="resumen-title">
        <div className="sa-card-head">
          <h2 id="resumen-title" className="sa-h2">Plata del mes</h2>
          <div className="flex gap-2">
            <div className="w-36">
              <label className="sr-only" htmlFor="cobros-mes">Mes</label>
              <select id="cobros-mes" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="sa-input capitalize">
                {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
              </select>
            </div>
            <div className="w-28 shrink-0">
              <label className="sr-only" htmlFor="cobros-anio">Año</label>
              <select id="cobros-anio" value={year} onChange={(e) => setYear(Number(e.target.value))} className="sa-input sa-num">
                {[today.y - 1, today.y, today.y + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="sa-card-pad grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
          <dl className="sa-divide">
            <Row label={`Valor de lista (${s.invoices} factura${s.invoices === 1 ? "" : "s"})`} value={formatCRC(s.list)} />
            <Row label="− Descuentos" value={`−${formatCRC(s.discounts)}`} muted />
            <Row label={`− Cortesías (${s.courtesyCount})`} value={`−${formatCRC(s.courtesies)}`} muted />
            <Row label="= Lo que deberías recibir" value={formatCRC(s.expected)} strong />
          </dl>
          <div className="flex flex-col gap-4 border-t border-[var(--sa-line)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <dl className="flex flex-wrap gap-x-8 gap-y-4">
              <Stat label="Cobrado" amount={s.paid} tone="ok" />
              <Stat label="Pendiente" amount={s.pending} tone="warn" />
              <Stat label="Atrasado" amount={s.late} tone="danger" />
            </dl>
            {summary.withoutInvoice.count > 0 && (
              <p className="sa-help">
                {summary.withoutInvoice.count} negocio(s) activo(s) todavía sin factura de este mes ({formatCRC(summary.withoutInvoice.expected)}).
              </p>
            )}
            <p className="sa-help">
              En {summary.year.year}: regalaste {formatCRC(summary.year.given)} (descuentos {formatCRC(summary.year.discounts)} · cortesías {formatCRC(summary.year.courtesies)}) y cobraste {formatCRC(summary.year.paid)}.
            </p>
          </div>
        </div>
      </section>

      {/* Cobro automático */}
      <section className="sa-card" aria-labelledby="auto-title">
        <div className="sa-card-head">
          <h2 id="auto-title" className="sa-h2">Cobro automático</h2>
          {settings.enabled ? (
            <span className="sa-chip sa-chip-ok"><Power aria-hidden />Encendido</span>
          ) : (
            <span className="sa-chip"><PowerOff aria-hidden />Apagado</span>
          )}
        </div>

        <div className="sa-card-pad flex flex-col gap-4">
          {settings.enabled && settings.startPeriod && (
            <p className="sa-muted">Maneja las facturas desde {periodOf(settings.startPeriod)}. Las anteriores no disparan avisos ni suspensiones.</p>
          )}
          {!cronConfigured && (
            <div className="sa-alert sa-alert-warn">
              <AlertTriangle aria-hidden />
              <span>Falta la variable CRON_SECRET en Vercel: la corrida diaria no va a correr sola. Mientras tanto se puede correr a mano.</span>
            </div>
          )}
          {run && (
            <p className="sa-muted">
              Próximo cobro: <strong className="sa-strong capitalize">{run.upcoming.period}</strong> · aviso el {run.upcoming.reminderDate} · vence el {run.upcoming.dueDate}
              {run.upcoming.suspendDate && <> · suspensión el {run.upcoming.suspendDate}</>} · {run.upcoming.tenants} negocio(s) pagan {formatCRC(run.upcoming.expected)}
              {run.upcoming.courtesies > 0 && <> · {run.upcoming.courtesies} cortesía(s)</>}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void execute(true)} disabled={running !== null} className="sa-btn sa-btn-secondary">
              <Eye className="w-4 h-4" aria-hidden />
              {running === "preview" ? "Revisando..." : "Ver qué haría hoy"}
            </button>
            <button
              type="button" onClick={() => void runNow()} disabled={running !== null || !settings.enabled}
              title={settings.enabled ? undefined : "Encendé el cobro automático para correrlo"}
              className="sa-btn sa-btn-primary"
            >
              <Play className="w-4 h-4" aria-hidden />
              {running === "real" ? "Corriendo..." : "Correr ahora"}
            </button>
          </div>

          {run && (
            <div className="sa-inset p-4 flex flex-col gap-3">
              <p className="sa-help">{run.dryRun ? "Vista previa (no cambió nada)" : "Corrida"} · {run.summary}</p>
              {run.actions.length > 0 && (
                <ul className="sa-divide">
                  {run.actions.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="sm:w-36 shrink-0"><ActionChip type={a.type} /></span>
                      <span className="sa-strong">{a.tenantName}</span>
                      <span className="sa-muted">{a.detail}</span>
                      {a.emailError && <span className="sa-error">correo sin enviar: {a.emailError}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {settings.lastRunAt && (
            <p className="sa-help">
              Última corrida: {new Date(settings.lastRunAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })} · {settings.lastRunSummary}
              {settings.lastRunError && <span className="sa-danger-text"> · {settings.lastRunError}</span>}
            </p>
          )}
        </div>
      </section>

      {/* Configuración */}
      <section className="sa-card" aria-labelledby="config-title">
        <div className="sa-card-head">
          <h2 id="config-title" className="sa-h2">Configuración</h2>
        </div>

        <div className="sa-card-pad flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <label className="sa-check">
              <input type="checkbox" checked={form.enabled} onChange={(e) => { setForm({ ...form, enabled: e.target.checked }); setSaveMsg(null); }} />
              <span>Cobro automático encendido</span>
            </label>
            <label className="sa-check">
              <input type="checkbox" checked={form.autoSuspend} onChange={(e) => { setForm({ ...form, autoSuspend: e.target.checked }); setSaveMsg(null); }} />
              <span>Suspender automáticamente al pasar los días de gracia</span>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <NumberField label="Días de aviso" value={form.reminderDays} onChange={(v) => setForm({ ...form, reminderDays: v })} />
              <NumberField label="Días de gracia" value={form.graceDays} onChange={(v) => setForm({ ...form, graceDays: v })} />
              {PLAN_KEYS.map((p) => (
                <NumberField key={p} label={`Precio ${PLAN_LABELS[p]} (₡)`} value={form.prices[p]} onChange={(v) => setForm({ ...form, prices: { ...form.prices, [p]: v } })} />
              ))}
            </div>
            <p className="sa-help">
              Se cobra el día 1. Con {form.reminderDays || "?"} días de aviso y {form.graceDays || "?"} de gracia: el recordatorio sale {form.reminderDays || "?"} días antes, otro aviso el día 1
              {form.autoSuspend ? `, y si no paga se suspende el día ${Number(form.graceDays) + 2 || "?"}` : ""}. Un precio nuevo aplica a las facturas siguientes.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="sa-eyebrow">Cómo pagar <span className="sa-help font-normal">(sale en los correos de cobro)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField label="SINPE Móvil" value={form.payment.sinpeNumber} placeholder="8888-8888" onChange={(v) => setPay("sinpeNumber", v)} />
              <TextField label="A nombre de" value={form.payment.sinpeName} onChange={(v) => setPay("sinpeName", v)} />
              <TextField label="IBAN" value={form.payment.iban} placeholder="CR00 0000 0000 0000 0000 00" onChange={(v) => setPay("iban", v)} />
              <TextField label="Titular de la cuenta" value={form.payment.ibanName} onChange={(v) => setPay("ibanName", v)} />
              <TextField label="WhatsApp para comprobantes" value={form.payment.whatsapp} placeholder="50688888888" onChange={(v) => setPay("whatsapp", v)} />
            </div>
            <label className="sa-field">
              <span className="sa-label">Indicaciones (opcional)</span>
              <textarea rows={2} maxLength={300} value={form.payment.notes} onChange={(e) => setPay("notes", e.target.value)} className="sa-input resize-none" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving} className="sa-btn sa-btn-primary">
              <Save className="w-4 h-4" aria-hidden />
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
            {saveMsg && <p role="status" className={saveMsg.ok ? "sa-success" : "sa-error"}>{saveMsg.text}</p>}
            {settings.updatedBy && <p className="sa-help">Último cambio: {settings.updatedBy}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  const tone = strong ? "sa-strong" : muted ? "sa-muted" : "";
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={tone}>{label}</dt>
      <dd className={`sa-num ${tone} ${strong ? "text-base" : ""}`}>{value}</dd>
    </div>
  );
}

// El color solo aparece cuando hay plata en esa cifra: un ₡0 atrasado no es una alarma.
function Stat({ label, amount, tone }: { label: string; amount: number; tone: keyof typeof TONE_TEXT }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="sa-stat-label">{label}</dt>
      <dd className="sa-stat-value"><span className={amount > 0 ? TONE_TEXT[tone] : undefined}>{formatCRC(amount)}</span></dd>
    </div>
  );
}

function ActionChip({ type }: { type: string }) {
  const { tone, Icon } = ACTION_CHIPS[type] ?? { tone: "", Icon: FileText };
  return <span className={`sa-chip ${tone}`}><Icon aria-hidden />{ACTION_LABELS[type] ?? type}</span>;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="sa-field justify-end">
      <span className="sa-label">{label}</span>
      <input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className="sa-input sa-num" />
    </label>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="sa-field">
      <span className="sa-label">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="sa-input" />
    </label>
  );
}
