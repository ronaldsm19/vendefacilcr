"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Send } from "lucide-react";

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
    return (
      <section className="sa-card sa-card-pad">
        <p className="sa-muted">Cargando alertas...</p>
      </section>
    );
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

  // Los números van dentro de la frase; la caja de ancho fijo evita que el campo ocupe toda la línea.
  const numberInput = (key: "spikeThreshold" | "spikeWindowMinutes" | "cooldownMinutes", label: string) => (
    <span className="w-20 shrink-0">
      <input
        id={`alertas-${key}`} aria-label={label} type="number" min={1} inputMode="numeric"
        value={form[key]} onChange={(e) => set(key, e.target.value)}
        className="sa-input sa-num text-center"
      />
    </span>
  );

  return (
    <section className="sa-card" aria-labelledby="alertas-title">
      <div className="sa-card-head">
        <div className="min-w-0">
          <h2 id="alertas-title" className="sa-h2">Alertas por correo</h2>
          <p className="sa-help">Te avisamos cuando hay un pico de errores o aparece un error grave nuevo.</p>
        </div>
        <label className="sa-check">
          <input id="alertas-enabled" type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          <span>Alertas activas</span>
        </label>
      </div>

      <div className="sa-card-pad flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <label className="sa-field">
            <span className="sa-label">Destinatarios (uno por línea, máximo 5)</span>
            <textarea
              id="alertas-recipients" rows={4} value={form.recipients} onChange={(e) => set("recipients", e.target.value)}
              placeholder="correo@ejemplo.com"
              className="sa-input resize-none"
            />
          </label>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="flex flex-wrap items-center gap-2">
                Avisar si hay {numberInput("spikeThreshold", "Cantidad de errores")} errores o más en {numberInput("spikeWindowMinutes", "Ventana en minutos")} minutos.
              </p>
              <p className="sa-help">Cuentan las fallas del servidor y las respuestas 5xx. La falta de conexión y el agente rechazado se ven en el panel, pero no disparan este correo.</p>
            </div>
            <p className="flex flex-wrap items-center gap-2">
              Esperar al menos {numberInput("cooldownMinutes", "Espera entre correos")} minutos entre correos de pico.
            </p>
            <label className="sa-check">
              <input id="alertas-new" type="checkbox" checked={form.notifyNewErrors} onChange={(e) => set("notifyNewErrors", e.target.checked)} />
              <span>
                Avisar la primera vez que aparece un error grave nuevo
                <span className="block sa-help">Fallas del servidor, respuestas 5xx y agente de impresión rechazado. La falta de conexión no avisa.</span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving || !dirty} className="sa-btn sa-btn-primary">
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button" onClick={() => void test()} disabled={testing || dirty || !settings.recipients.length}
            title={dirty ? "Guardá antes de probar" : undefined}
            className="sa-btn sa-btn-secondary"
          >
            <Send className="w-4 h-4" aria-hidden />
            {testing ? "Enviando..." : "Enviar correo de prueba"}
          </button>
          {message && (
            <span role="status" className={`inline-flex items-center gap-1.5 ${message.tone === "ok" ? "sa-success" : "sa-error"}`}>
              {message.tone === "ok" && <Check className="w-4 h-4" aria-hidden />}
              {message.text}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--sa-line)] pt-4">
          <p className="sa-help">{settings.lastSentAt ? `Último correo enviado: ${fmtDateTime(settings.lastSentAt)}` : "Todavía no se envió ningún correo."}</p>
          {settings.lastSendError && (
            <div className="sa-alert sa-alert-danger">
              <CircleAlert aria-hidden />
              <span className="min-w-0 break-words">Falló el último envío: {settings.lastSendError}</span>
            </div>
          )}
          {settings.updatedBy && settings.updatedAt && <p className="sa-help">Cambiado por {settings.updatedBy} el {fmtDateTime(settings.updatedAt)}</p>}
        </div>
      </div>
    </section>
  );
}
