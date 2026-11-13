import nodemailer from "nodemailer";
import { VF_LOGO_BASE64 } from "@/lib/vf-logo";

const LOGO_CID = "vflogo";

/** URL pública base del sitio (sin slash final). */
export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vendefacilcr.vercel.app").replace(/\/$/, "");
}

// ── Transporter perezoso ──────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      // 465 es TLS directo; 587 (y los demás) negocian STARTTLS.
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Envía un correo. NUNCA lanza: si SMTP no está configurado o falla, se
 * registra el error y se retorna { ok: false } sin romper la operación principal.
 */
export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Para probar en desarrollo sin mandar correos de verdad (nunca se define en producción).
  if (process.env.EMAIL_DRY_RUN === "1") {
    console.log(`[email] (sin envío) para=${to} asunto="${subject}"`);
    return { ok: true };
  }
  const tx = getTransporter();
  if (!tx) {
    console.warn("[email] SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS); correo no enviado:", subject);
    return { ok: false, error: "SMTP no configurado (faltan variables SMTP_*)" };
  }
  try {
    // SMTP_FROM permite un remitente distinto del usuario SMTP: con un servicio de envío y dominio
    // propio (el usuario suele ser fijo, tipo "resend") la dirección tiene que ser de ese dominio.
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
    await tx.sendMail({
      from: `Ennea <${from}>`,
      to,
      subject,
      html,
      // Logo embebido inline (CID) — no depende de un host externo
      attachments: [
        {
          filename: "ennea.png",
          content: Buffer.from(VF_LOGO_BASE64, "base64"),
          cid: LOGO_CID,
          contentType: "image/png",
        },
      ],
    });
    return { ok: true };
  } catch (error) {
    console.error("[email] Error enviando correo:", subject, error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Plantillas HTML de marca ──────────────────────────────────────

// Marca Ennea (no la del negocio): azul noche con la campana de servicio en latón. Los enlaces van en
// latón oscuro, que se lee bien sobre blanco.
const BRAND_GRADIENT = "#15223B";
const BRAND_PURPLE = "#7A5E1C";

/** Envoltura común: header con degradado + logo, cuerpo y footer. */
function layout(title: string, bodyHtml: string): string {
  const logo = `cid:${LOGO_CID}`;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF1F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(21,34,59,0.08);">
        <tr>
          <td style="background:${BRAND_GRADIENT};padding:32px 32px 28px;text-align:center;">
            <img src="${logo}" alt="Ennea" width="56" height="56" style="display:inline-block;border-radius:14px;" />
            <h1 style="margin:14px 0 0;color:#ffffff;font-size:22px;font-weight:700;">${title}</h1>
          </td>
        </tr>
        <tr><td style="padding:32px;color:#15223B;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #E3E6EC;text-align:center;color:#15223B80;font-size:12px;">
            Ennea — Comandas, caja y números de tu negocio en un solo lugar.<br/>
            <a href="${getBaseUrl()}" style="color:${BRAND_PURPLE};text-decoration:none;">${getBaseUrl().replace(/^https?:\/\//, "")}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function linkRow(label: string, url: string): string {
  return `<div style="margin:0 0 14px;">
    <p style="margin:0 0 2px;font-size:13px;color:#15223B99;">${label}</p>
    <a href="${url}" style="color:${BRAND_PURPLE};font-weight:600;text-decoration:none;word-break:break-all;">${url}</a>
  </div>`;
}

export function welcomeEmailHtml({
  name,
  slug,
  email,
  tempPassword,
}: {
  name: string;
  slug: string;
  email: string;
  tempPassword: string;
}): string {
  const base = getBaseUrl();
  const body = `
    <p style="margin:0 0 16px;">¡Hola <strong>${name}</strong>! 🎉</p>
    <p style="margin:0 0 20px;">Tu negocio ya está listo en Ennea. Acá están tus accesos:</p>

    ${linkRow("Tu página de ventas / pedidos:", `${base}/${slug}`)}
    ${linkRow("Tu menú:", `${base}/${slug}/menu`)}
    ${linkRow("Panel de administración:", `${base}/${slug}/admin/login`)}

    <div style="margin:24px 0;padding:18px 20px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:13px;color:#15223B99;">Usuario (correo)</p>
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#15223B;">${email}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#15223B99;">Contraseña temporal</p>
      <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:1px;color:${BRAND_PURPLE};font-family:monospace;">${tempPassword}</p>
    </div>

    <p style="margin:0;font-size:13px;color:#15223B99;">
      🔒 Por seguridad, ingresá al panel y <strong>actualizá tu contraseña</strong> desde la sección
      <em>Perfil</em> en tu primera sesión.
    </p>`;
  return layout("Te damos la bienvenida a Ennea", body);
}

/** Escapa texto que viene de afuera (mensajes de error, nombres) antes de meterlo en el HTML del correo. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface AlertEmailSection {
  heading: string;
  /** Cada fila: texto a la izquierda y cifra a la derecha. Ya escapados. */
  rows: { label: string; value: string }[];
}

/** Correo de alerta de errores para el superadmin. Los textos de las secciones ya vienen escapados. */
export function errorAlertEmailHtml({
  title,
  intro,
  sections,
  panelUrl,
}: {
  title: string;
  intro: string;
  sections: AlertEmailSection[];
  panelUrl: string;
}): string {
  const blocks = sections
    .filter((s) => s.rows.length)
    .map((s) => `
      <p style="margin:24px 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#15223B99;">${s.heading}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${s.rows.map((r) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #E3E6EC;font-size:14px;color:#15223B;">${r.label}</td>
            <td style="padding:8px 0 8px 12px;border-bottom:1px solid #E3E6EC;font-size:14px;font-weight:700;color:#15223B;text-align:right;white-space:nowrap;">${r.value}</td>
          </tr>`).join("")}
      </table>`)
    .join("");
  const body = `
    <p style="margin:0 0 8px;">${intro}</p>
    ${blocks}
    <p style="margin:28px 0 0;text-align:center;">
      <a href="${panelUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${BRAND_GRADIENT};color:#ffffff;font-weight:700;text-decoration:none;">Ver el panel de errores</a>
    </p>`;
  return layout(title, body);
}

export interface BillingEmailPayment {
  sinpeNumber: string;
  sinpeName: string;
  iban: string;
  ibanName: string;
  whatsapp: string;
  notes: string;
}

/**
 * Correo de cobro al dueño de un negocio: recordatorio, vencimiento, suspensión o fin del periodo
 * sin costo. Los textos que vienen de afuera (nombres, etiquetas, instrucciones) se escapan acá.
 */
export function billingEmailHtml({
  title,
  intro,
  rows,
  totalLabel,
  totalValue,
  note,
  payment,
  panelUrl,
}: {
  title: string;
  /** HTML ya armado con datos escapados. */
  intro: string;
  /** Filas del detalle (texto plano: se escapan acá). */
  rows: { label: string; value: string; muted?: boolean }[];
  totalLabel: string;
  totalValue: string;
  /** HTML ya armado con datos escapados. */
  note?: string;
  payment: BillingEmailPayment | null;
  panelUrl: string;
}): string {
  const detail = rows.map((r) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E3E6EC;font-size:14px;color:${r.muted ? "#15223B99" : "#15223B"};">${escapeHtml(r.label)}</td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #E3E6EC;font-size:14px;color:${r.muted ? "#15223B99" : "#15223B"};text-align:right;white-space:nowrap;">${escapeHtml(r.value)}</td>
      </tr>`).join("");

  const p = payment;
  const lines: string[] = [];
  if (p?.sinpeNumber) lines.push(`<strong>SINPE Móvil:</strong> ${escapeHtml(p.sinpeNumber)}${p.sinpeName ? ` (${escapeHtml(p.sinpeName)})` : ""}`);
  if (p?.iban) lines.push(`<strong>IBAN:</strong> ${escapeHtml(p.iban)}${p.ibanName ? ` (${escapeHtml(p.ibanName)})` : ""}`);
  if (p?.notes) lines.push(escapeHtml(p.notes).replace(/\n/g, "<br/>"));
  const wa = (p?.whatsapp ?? "").replace(/\D/g, "");
  if (wa) lines.push(`Mandá el comprobante por WhatsApp al <a href="https://wa.me/${wa}" style="color:${BRAND_PURPLE};font-weight:600;text-decoration:none;">${escapeHtml(p!.whatsapp)}</a>.`);
  const howToPay = lines.length
    ? `<div style="margin:24px 0 0;padding:16px 18px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#15223B99;">CÓMO PAGAR</p>
        ${lines.map((l) => `<p style="margin:0 0 6px;font-size:14px;color:#15223B;">${l}</p>`).join("")}
      </div>`
    : `<p style="margin:24px 0 0;font-size:14px;color:#15223B;">Para coordinar el pago, contactá a Ennea.</p>`;

  const body = `
    <p style="margin:0 0 16px;">${intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${detail}
      <tr>
        <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#15223B;">${escapeHtml(totalLabel)}</td>
        <td style="padding:12px 0 0 12px;font-size:18px;font-weight:700;color:#15223B;text-align:right;white-space:nowrap;">${escapeHtml(totalValue)}</td>
      </tr>
    </table>
    ${note ? `<p style="margin:20px 0 0;font-size:14px;color:#15223B;">${note}</p>` : ""}
    ${payment ? howToPay : ""}
    <p style="margin:28px 0 0;text-align:center;">
      <a href="${panelUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${BRAND_GRADIENT};color:#ffffff;font-weight:700;text-decoration:none;">Ir a mi panel</a>
    </p>`;
  return layout(title, body);
}

export function passwordChangedEmailHtml({ name }: { name: string }): string {
  const body = `
    <p style="margin:0 0 16px;">Hola <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">
      Te confirmamos que la contraseña de tu panel de administración fue
      <strong>cambiada correctamente</strong>. ✅
    </p>
    <p style="margin:0;font-size:13px;color:#15223B99;">
      Si no realizaste este cambio, contactá de inmediato a Ennea.
    </p>`;
  return layout("Contraseña actualizada", body);
}
