"use client";

import { useEffect, useState } from "react";
import { Mail, Send, Check } from "lucide-react";

interface Settings {
  enabled: boolean;
  recipients: string[];
  spikeThreshold: number;
  spikeWindowMinutes: number;
  cooldownMinutes: number;
  notifyNewErrors: boolean;
  lastSentAt: string | null;
  lastSendError: string;
  updatedBy: string;
  updatedAt?: string;
}

interface Form {
  enabled: boolean;
  recipients: string;
  spikeThreshold: string;
  spikeWindowMinutes: string;
  cooldownMinutes: string;
  notifyNewErrors: boolean;
}

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" };
const FIELD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" as const };

function toForm(s: Settings): Form {
  return {
    enabled: s.enabled,
    recipients: s.recipients.join("\n"),
    spikeThreshold: String(s.spikeThreshold),
    spikeWindowMinutes: String(s.spikeWindowMinutes),
    cooldownMinutes: String(s.cooldownMinutes),
    notifyNewErrors: s.notifyNewErrors,
  };
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Configuración de los correos de alerta: destinatarios, umbral del pico y correo de error nuevo. */
export default function AlertasCorreo() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/alertas")
      .then((r) => r.json())
      .then((d) => { if (d.settings) { setSettings(d.settings); setForm(toForm(d.settings)); } })
      .catch(() => setMessage({ tone: "error", text: "No se pudo cargar la configuración de alertas." }));
  }, []);

  if (!form || !settings) {
    return <div className="rounded-2xl p-5 text-white/30 text-sm" style={CARD}>Cargando alertas...</div>;
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/superadmin/alertas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          recipients: form.recipients.split(/[\s,;]+/).filter(Boolean),
          spikeThreshold: Number(form.spikeThreshold),
          spikeWindowMinutes: Number(form.spikeWindowMinutes),
          cooldownMinutes: Number(form.cooldownMinutes),
          notifyNewErrors: form.notifyNewErrors,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setMessage({ tone: "error", text: d.error ?? "No se pudo guardar" }); return; }
      setSettings(d.settings);
      setForm(toForm(d.settings));
      setMessage({ tone: "ok", text: "Guardado" });
    } catch {
      setMessage({ tone: "error", text: "No se pudo guardar. Revisá tu conexión." });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/superadmin/alertas/prueba", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setMessage({ tone: "error", text: d.error ?? "No se pudo enviar el correo de prueba" });
      } else {
        setMessage({ tone: "ok", text: `Correo de prueba enviado a ${d.recipients.join(", ")}` });
      }
      const fresh = await fetch("/api/superadmin/alertas").then((r) => r.json());
      if (fresh.settings) setSettings(fresh.settings);
    } catch {
      setMessage({ tone: "error", text: "No se pudo enviar. Revisá tu conexión." });
    } finally {
      setTesting(false);
    }
  }

  const numberInput = (key: "spikeThreshold" | "spikeWindowMinutes" | "cooldownMinutes", label: string) => (
    <input
      id={`alertas-${key}`} aria-label={label} type="number" min={1} inputMode="numeric"
      value={form[key]} onChange={(e) => set(key, e.target.value)}
      className="w-20 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none tabular-nums" style={FIELD}
    />
  );

  return (
    <section className="rounded-2xl p-5 md:p-6 space-y-5" style={CARD} aria-labelledby="alertas-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(147,51,234,0.12)", border: "1px solid rgba(147,51,234,0.25)" }}>
            <Mail className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <h2 id="alertas-title" className="text-white font-semibold">Alertas por correo</h2>
            <p className="text-white/40 text-sm mt-0.5">Te avisamos cuando hay un pico de errores o aparece un error grave nuevo.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
          <input id="alertas-enabled" type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} className="w-4 h-4 accent-purple-500" />
          Alertas activas
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label htmlFor="alertas-recipients" className="block text-sm text-white/60">Destinatarios (uno por línea, máximo 5)</label>
          <textarea
            id="alertas-recipients" rows={4} value={form.recipients} onChange={(e) => set("recipients", e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none resize-none font-mono" style={FIELD}
          />
        </div>
        <div className="space-y-4 text-sm text-white/70">
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              Avisar si hay {numberInput("spikeThreshold", "Cantidad de errores")} errores o más en {numberInput("spikeWindowMinutes", "Ventana en minutos")} minutos.
            </p>
            <p className="text-xs text-white/35">Cuentan las fallas del servidor y las respuestas 5xx. La falta de conexión y el agente rechazado se ven en el panel, pero no disparan este correo.</p>
          </div>
          <p className="flex flex-wrap items-center gap-2">
            Esperar al menos {numberInput("cooldownMinutes", "Espera entre correos")} minutos entre correos de pico.
          </p>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input id="alertas-new" type="checkbox" checked={form.notifyNewErrors} onChange={(e) => set("notifyNewErrors", e.target.checked)} className="w-4 h-4 mt-0.5 accent-purple-500" />
            <span>
              Avisar la primera vez que aparece un error grave nuevo
              <span className="block text-xs text-white/35">Fallas del servidor, respuestas 5xx y agente de impresión rechazado. La falta de conexión no avisa.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={() => void save()} disabled={saving || !dirty}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white saas-accent-bg disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button" onClick={() => void test()} disabled={testing || dirty || !settings.recipients.length}
          title={dirty ? "Guardá antes de probar" : undefined}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-default"
          style={FIELD}
        >
          <Send className="w-3.5 h-3.5" /> {testing ? "Enviando..." : "Enviar correo de prueba"}
        </button>
        {message && (
          <span role="status" className={`flex items-center gap-1.5 text-sm ${message.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>
            {message.tone === "ok" && <Check className="w-4 h-4" />} {message.text}
          </span>
        )}
      </div>

      <div className="text-xs text-white/35 space-y-1 border-t border-white/5 pt-4">
        <p>{settings.lastSentAt ? `Último correo enviado: ${fmtDateTime(settings.lastSentAt)}` : "Todavía no se envió ningún correo."}</p>
        {settings.lastSendError && <p className="text-red-300">Falló el último envío: {settings.lastSendError}</p>}
        {settings.updatedBy && settings.updatedAt && <p>Cambiado por {settings.updatedBy} el {fmtDateTime(settings.updatedAt)}</p>}
      </div>
    </section>
  );
}
