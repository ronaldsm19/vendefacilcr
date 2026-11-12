import crypto from "crypto";

/**
 * El código que muestra la computadora del negocio para marcar jornada desde el teléfono.
 *
 * Cambia solo cada medio minuto y no se guarda en ningún lado: sale de una cuenta que el
 * servidor puede repetir cuando el teléfono lo manda de vuelta. Es la misma idea de los códigos
 * de seis dígitos de una app de autenticación, con el negocio como dueño del código.
 *
 * Qué prueba y qué no. Prueba que quien marca tuvo delante la pantalla del negocio hace menos
 * de un minuto. NO dice quién es: eso lo dice la sesión del teléfono. Por eso varias personas
 * pueden usar el mismo código a la vez, y por eso una foto del código mandada a alguien que no
 * está en el local sirve, como mucho, un minuto.
 *
 * Sin dependencias de la base ni de Next, para poder probarlo con Node.
 */

/** Cada cuánto cambia el código en pantalla. */
export const SHIFT_QR_STEP_MS = 30_000;

/** Ocho caracteres, sin los que se confunden al dictarlos o copiarlos (0/O, 1/I/L, U). */
export const SHIFT_QR_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const SHIFT_QR_LENGTH = 8;

/**
 * Lo que va adelante del código dentro del QR. Distingue este QR del que vincula un teléfono:
 * si alguien escanea el equivocado, la app puede decirlo en vez de fallar sin explicación.
 */
export const SHIFT_QR_PREFIX = "VFJ:";

/** En qué tramo de medio minuto cae un instante. */
export function shiftQrStep(nowMs: number): number {
  return Math.floor(nowMs / SHIFT_QR_STEP_MS);
}

/** El código de un negocio en un tramo. Mismo secreto, negocio y tramo dan siempre lo mismo. */
export function shiftQrCode(secret: string, tenantId: string, step: number): string {
  const digest = crypto.createHmac("sha256", secret).update(`shift-qr:v1:${tenantId}:${step}`).digest();
  let out = "";
  for (let i = 0; i < SHIFT_QR_LENGTH; i++) {
    // Dos bytes por carácter: con uno solo, 256 no se reparte parejo entre 30 letras.
    out += SHIFT_QR_ALPHABET[digest.readUInt16BE(i * 2) % SHIFT_QR_ALPHABET.length];
  }
  return out;
}

/** "vfj:ab2k-9xrt", "AB2K 9XRT" y "AB2K9XRT" son el mismo código. */
export function normalizeShiftQrCode(raw: string): string {
  const trimmed = raw.trim();
  const body = trimmed.toUpperCase().startsWith(SHIFT_QR_PREFIX) ? trimmed.slice(SHIFT_QR_PREFIX.length) : trimmed;
  return body.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * ¿Este código es el del negocio ahora?
 *
 * Vale el del tramo actual y el del anterior. Sin el anterior, quien escanea justo cuando la
 * pantalla cambia se queda con un código vencido en la mano: desde que se ve hasta que llega
 * al servidor pasan uno o dos segundos. Así un código vive entre medio minuto y un minuto.
 */
export function matchesShiftQr(secret: string, tenantId: string, raw: string, nowMs: number): boolean {
  const given = Buffer.from(normalizeShiftQrCode(raw));
  if (given.length !== SHIFT_QR_LENGTH) return false;
  const step = shiftQrStep(nowMs);
  let ok = false;
  for (const s of [step, step - 1]) {
    // Se comparan los dos siempre y sin cortar antes: el tiempo que tarda no delata nada.
    if (crypto.timingSafeEqual(given, Buffer.from(shiftQrCode(secret, tenantId, s)))) ok = true;
  }
  return ok;
}
