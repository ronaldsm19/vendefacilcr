import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { sendMail, errorAlertEmailHtml, escapeHtml, getBaseUrl, type AlertEmailSection } from "@/lib/email";
import { ErrorEvent, type IErrorEvent } from "@/models/ErrorEvent";
import {
  ErrorAlertSettings, ERROR_ALERT_DEFAULTS, ERROR_ALERT_LIMITS, type IErrorAlertSettings,
} from "@/models/ErrorAlertSettings";
import { Tenant } from "@/models/Tenant";
import { ServiceError } from "@/server/errors";

/**
 * Correos de alerta de errores. Se revisan cada vez que llega un error (no hace falta un cron):
 * - Pico: N fallas del servidor o más en los últimos M minutos (ver SPIKE_MATCH), como mucho uno
 *   cada `cooldownMinutes`.
 * - Error nuevo: la primera vez que aparece un error grave. Se juntan los que lleguen seguidos y
 *   salen como mucho cada NEW_ERROR_COOLDOWN_MS; si quedan pendientes, van en el próximo correo.
 */

const NEW_ERROR_COOLDOWN_MS = 10 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lo que cuenta para el pico: fallas del servidor (5xx y excepciones). Quedan fuera los pedidos sin
 * respuesta, porque un corte de wifi de dos minutos en un solo negocio ya pasa el umbral (el panel
 * consulta varias cosas cada 30 s), y los rechazos al agente, porque un agente con un token viejo
 * reintenta cada 30 s para siempre y mandaría un correo de pico cada hora. Los dos se ven en el panel,
 * y el rechazo al agente además avisa una vez con el correo de error nuevo.
 */
const SPIKE_MATCH = { level: "error", kind: { $in: ["respuesta", "excepcion"] } };

type SettingsLean = IErrorAlertSettings;

export async function getAlertSettings(): Promise<SettingsLean> {
  await connectToDatabase();
  return ErrorAlertSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global", ...ERROR_ALERT_DEFAULTS } },
    { upsert: true, returnDocument: "after" },
  ).lean() as Promise<SettingsLean>;
}

function intIn(value: unknown, { min, max }: { min: number; max: number }, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ServiceError(400, `${label}: tiene que ser un número entero entre ${min} y ${max}`);
  }
  return value;
}

/** Valida y guarda la configuración que llega del superadmin. */
export async function updateAlertSettings(raw: Record<string, unknown>, updatedBy: string): Promise<SettingsLean> {
  if (typeof raw.enabled !== "boolean") throw new ServiceError(400, "Falta indicar si las alertas están activas");
  if (typeof raw.notifyNewErrors !== "boolean") throw new ServiceError(400, "Falta indicar si se avisan los errores nuevos");
  if (!Array.isArray(raw.recipients)) throw new ServiceError(400, "Los destinatarios tienen que ser una lista");

  const recipients = [...new Set(
    raw.recipients.map((r) => (typeof r === "string" ? r.trim().toLowerCase() : "")).filter(Boolean),
  )];
  const invalid = recipients.find((r) => !EMAIL_RE.test(r) || r.length > 120);
  if (invalid) throw new ServiceError(400, `Correo inválido: ${invalid}`);
  if (recipients.length > ERROR_ALERT_LIMITS.maxRecipients) {
    throw new ServiceError(400, `Máximo ${ERROR_ALERT_LIMITS.maxRecipients} destinatarios`);
  }
  if (raw.enabled && !recipients.length) {
    throw new ServiceError(400, "Para activar las alertas agregá al menos un destinatario");
  }

  await connectToDatabase();
  return ErrorAlertSettings.findOneAndUpdate(
    { key: "global" },
    {
      $set: {
        enabled: raw.enabled,
        recipients,
        spikeThreshold: intIn(raw.spikeThreshold, ERROR_ALERT_LIMITS.spikeThreshold, "Cantidad de errores"),
        spikeWindowMinutes: intIn(raw.spikeWindowMinutes, ERROR_ALERT_LIMITS.spikeWindowMinutes, "Ventana en minutos"),
        cooldownMinutes: intIn(raw.cooldownMinutes, ERROR_ALERT_LIMITS.cooldownMinutes, "Espera entre correos"),
        notifyNewErrors: raw.notifyNewErrors,
        updatedBy,
      },
      $setOnInsert: { key: "global" },
    },
    { upsert: true, returnDocument: "after" },
  ).lean() as Promise<SettingsLean>;
}

/**
 * Reserva el envío con una sola escritura condicionada: si dos instancias llegan a la vez, solo
 * una ve el campo vencido y manda el correo.
 */
async function claim(field: "lastSpikeAlertAt" | "lastNewErrorAlertAt", cooldownMs: number, now: number): Promise<boolean> {
  const r = await ErrorAlertSettings.updateOne(
    { key: "global", $or: [{ [field]: null }, { [field]: { $lte: new Date(now - cooldownMs) } }] },
    { $set: { [field]: new Date(now) } },
  );
  return r.modifiedCount === 1;
}

async function deliver(settings: SettingsLean, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const results = await Promise.all(settings.recipients.map((to) => sendMail({ to, subject, html })));
  const failed = results.find((r) => !r.ok);
  await ErrorAlertSettings.updateOne(
    { key: "global" },
    { $set: failed ? { lastSendError: failed.error ?? "No se pudo enviar el correo" } : { lastSentAt: new Date(), lastSendError: "" } },
  );
  return failed ? { ok: false, error: failed.error } : { ok: true };
}

const crTime = (d: Date) =>
  d.toLocaleString("es-CR", { timeZone: "America/Costa_Rica", day: "2-digit", month: "2-digit", hour: "numeric", minute: "2-digit" });

async function tenantNames(ids: unknown[]): Promise<Map<string, string>> {
  const valid = ids.filter((id): id is mongoose.Types.ObjectId => id instanceof mongoose.Types.ObjectId);
  if (!valid.length) return new Map();
  const rows = await Tenant.find({ _id: { $in: valid } }).select("name slug").lean() as { _id: unknown; name: string; slug: string }[];
  return new Map(rows.map((t) => [String(t._id), t.name || t.slug]));
}

/** Resumen de los errores de una ventana: por API, por negocio y mensajes más repetidos. */
async function spikeSections(since: Date): Promise<AlertEmailSection[]> {
  const match = { $match: { ...SPIKE_MATCH, lastAt: { $gte: since } } };
  const [apis, tenants, messages] = await Promise.all([
    ErrorEvent.aggregate([match, { $group: { _id: { m: "$method", r: "$route" }, n: { $sum: "$count" } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
    ErrorEvent.aggregate([match, { $group: { _id: "$tenantId", n: { $sum: "$count" } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
    ErrorEvent.aggregate([match, { $group: { _id: "$message", n: { $sum: "$count" } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
  ]);
  const names = await tenantNames(tenants.map((t) => t._id));
  return [
    { heading: "Por API", rows: apis.map((a) => ({ label: escapeHtml(`${a._id.m} ${a._id.r}`.trim()), value: String(a.n) })) },
    { heading: "Por negocio", rows: tenants.map((t) => ({ label: escapeHtml(t._id ? names.get(String(t._id)) ?? "Negocio borrado" : "Sin negocio identificado"), value: String(t.n) })) },
    { heading: "Mensajes", rows: messages.map((m) => ({ label: escapeHtml(m._id || "(sin mensaje)"), value: String(m.n) })) },
  ];
}

/** Revisa si corresponde mandar algún correo. Nunca lanza: una alerta que falla no rompe el pedido. */
export async function checkErrorAlerts(now = Date.now()): Promise<void> {
  try {
    const settings = await getAlertSettings();
    if (!settings.enabled || !settings.recipients.length) return;
    const panelUrl = `${getBaseUrl()}/superadmin/errores`;

    // 1. Pico de errores.
    const since = new Date(now - settings.spikeWindowMinutes * 60_000);
    const [{ total = 0 } = {}] = await ErrorEvent.aggregate([
      { $match: { ...SPIKE_MATCH, lastAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]);
    if (total >= settings.spikeThreshold && await claim("lastSpikeAlertAt", settings.cooldownMinutes * 60_000, now)) {
      await deliver(settings, `${total} errores en ${settings.spikeWindowMinutes} min — VendeFácil`, errorAlertEmailHtml({
        title: "Pico de errores",
        intro: `Hubo <strong>${total} errores</strong> en los últimos ${settings.spikeWindowMinutes} minutos (hasta las ${escapeHtml(crTime(new Date(now)))}). No vas a recibir otro correo de pico en los próximos ${settings.cooldownMinutes} minutos.`,
        sections: await spikeSections(since),
        panelUrl,
      }));
    }

    // 2. Errores graves nuevos.
    if (!settings.notifyNewErrors) return;
    const pending = await ErrorEvent.find({ firstSeen: true, notifiedAt: null, lastAt: { $gte: new Date(now - 24 * 3_600_000) } })
      .sort({ firstAt: 1 }).limit(20).lean() as unknown as IErrorEvent[];
    if (!pending.length || !await claim("lastNewErrorAlertAt", NEW_ERROR_COOLDOWN_MS, now)) return;
    const names = await tenantNames(pending.map((p) => p.tenantId));
    const sent = await deliver(settings, pending.length === 1
      ? `Error nuevo: ${pending[0].message.slice(0, 70) || pending[0].route} — VendeFácil`
      : `${pending.length} errores nuevos — VendeFácil`, errorAlertEmailHtml({
      title: pending.length === 1 ? "Error nuevo" : `${pending.length} errores nuevos`,
      intro: "Estos errores aparecieron por primera vez en los últimos 90 días.",
      sections: [{
        heading: "Errores",
        rows: pending.map((p) => ({
          label: `${escapeHtml(p.message || "(sin mensaje)")}<br/><span style="font-size:12px;color:#1A1A2E99;">${escapeHtml(`${p.method} ${p.route}`.trim())} · ${escapeHtml(p.tenantId ? names.get(String(p.tenantId)) ?? "Negocio borrado" : "Sin negocio identificado")} · ${escapeHtml(crTime(new Date(p.firstAt)))}</span>`,
          value: p.status ? String(p.status) : "—",
        })),
      }],
      panelUrl,
    }));
    if (sent.ok) {
      await ErrorEvent.updateMany({ _id: { $in: pending.map((p) => p._id) } }, { $set: { notifiedAt: new Date(now) } });
    }
  } catch (err) {
    console.error("[errores] no se pudo revisar las alertas", err);
  }
}

/** Correo de prueba a los destinatarios guardados. */
export async function sendTestAlert(): Promise<{ ok: boolean; error?: string; recipients: string[] }> {
  const settings = await getAlertSettings();
  if (!settings.recipients.length) throw new ServiceError(400, "Agregá al menos un destinatario y guardá antes de probar");
  const result = await deliver(settings, "Correo de prueba — Errores VendeFácil", errorAlertEmailHtml({
    title: "Correo de prueba",
    intro: "Si te llegó este correo, las alertas de errores de VendeFácil están bien configuradas.",
    sections: [],
    panelUrl: `${getBaseUrl()}/superadmin/errores`,
  }));
  return { ...result, recipients: settings.recipients };
}
