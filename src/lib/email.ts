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
      secure: false, // 587 usa STARTTLS
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
  const tx = getTransporter();
  if (!tx) {
    console.warn("[email] SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS); correo no enviado:", subject);
    return { ok: false, error: "SMTP no configurado (faltan variables SMTP_*)" };
  }
  try {
    const from = process.env.SMTP_USER!;
    await tx.sendMail({
      from: `VendeFácil CR <${from}>`,
      to,
      subject,
      html,
      // Logo embebido inline (CID) — no depende de un host externo
      attachments: [
        {
          filename: "vendefacil.png",
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

// Marca VendeFácil (no la del tenant): degradado azul→morado + rayo blanco.
const BRAND_GRADIENT = "linear-gradient(135deg,#3b82f6 0%,#9333ea 100%)";
const BRAND_PURPLE = "#9333ea";

/** Envoltura común: header con degradado + logo, cuerpo y footer. */
function layout(title: string, bodyHtml: string): string {
  const logo = `cid:${LOGO_CID}`;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F0F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F0F5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);">
        <tr>
          <td style="background:${BRAND_GRADIENT};padding:32px 32px 28px;text-align:center;">
            <img src="${logo}" alt="VendeFácil CR" width="56" height="56" style="display:inline-block;border-radius:14px;background:#ffffff;padding:6px;" />
            <h1 style="margin:14px 0 0;color:#ffffff;font-size:22px;font-weight:700;">${title}</h1>
          </td>
        </tr>
        <tr><td style="padding:32px;color:#1A1A2E;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #F0E6EE;text-align:center;color:#1A1A2E80;font-size:12px;">
            VendeFácil CR — Tu tienda en línea, fácil.<br/>
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
    <p style="margin:0 0 2px;font-size:13px;color:#1A1A2E99;">${label}</p>
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
    <p style="margin:0 0 20px;">Tu tienda en VendeFácil CR ya está lista. Acá están tus accesos:</p>

    ${linkRow("Tu página de ventas / pedidos:", `${base}/${slug}`)}
    ${linkRow("Tu menú:", `${base}/${slug}/menu`)}
    ${linkRow("Panel de administración:", `${base}/${slug}/admin/login`)}

    <div style="margin:24px 0;padding:18px 20px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:13px;color:#1A1A2E99;">Usuario (correo)</p>
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1A1A2E;">${email}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#1A1A2E99;">Contraseña temporal</p>
      <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:1px;color:${BRAND_PURPLE};font-family:monospace;">${tempPassword}</p>
    </div>

    <p style="margin:0;font-size:13px;color:#1A1A2E99;">
      🔒 Por seguridad, ingresá al panel y <strong>actualizá tu contraseña</strong> desde la sección
      <em>Perfil</em> en tu primera sesión.
    </p>`;
  return layout("¡Bienvenido a VendeFácil!", body);
}

export function passwordChangedEmailHtml({ name }: { name: string }): string {
  const body = `
    <p style="margin:0 0 16px;">Hola <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">
      Te confirmamos que la contraseña de tu panel de administración fue
      <strong>cambiada correctamente</strong>. ✅
    </p>
    <p style="margin:0;font-size:13px;color:#1A1A2E99;">
      Si no realizaste este cambio, contactá de inmediato a VendeFácil CR.
    </p>`;
  return layout("Contraseña actualizada", body);
}
