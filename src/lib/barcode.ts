/**
 * Códigos de barras de los productos. Cada negocio usa los suyos: internos y cortos (1105, 10001)
 * o el que ya trae el empaque de fábrica (EAN-13 y similares). Por eso el código es texto libre y
 * no se le impone un formato: los que ya están pegados en los productos tienen que seguir sirviendo.
 */

export const MAX_BARCODE = 48;

/**
 * Lo que un lector puede "escribir" en Code 128, Code 39 o EAN: letras, números y unos pocos
 * signos. Sin espacios, que el lector no manda y que solo traen confusiones al copiar y pegar.
 */
const BARCODE_RE = /^[0-9A-Za-z\-.\/+%$]+$/;

/**
 * Limpia un código que llegó del formulario, del lector o de un archivo.
 * "" = sin código; null = trae caracteres que ningún lector manda o es demasiado largo.
 */
export function normalizeBarcode(raw: unknown): string | null {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const code = String(raw).trim();
  if (code === "") return "";
  if (code.length > MAX_BARCODE || !BARCODE_RE.test(code)) return null;
  // En mayúsculas: Code 39 no las distingue y así un mismo código no se puede guardar dos veces.
  return code.toUpperCase();
}

/** Igualdad al escanear: sin distinguir mayúsculas (Code 39 no las distingue). */
export function sameBarcode(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  return a.toUpperCase() === b.toUpperCase();
}

/** Primer código que se sugiere cuando el negocio todavía no tiene ninguno interno. */
export const FIRST_INTERNAL_CODE = 1001;

/**
 * Siguiente código interno libre: el número más alto que ya usa el negocio, más uno. Solo cuenta
 * los códigos internos (de hasta 7 dígitos), así un EAN-13 de fábrica no hace saltar la numeración.
 */
export function nextInternalCode(existing: (string | undefined | null)[]): string {
  let max = FIRST_INTERNAL_CODE - 1;
  const used = new Set<string>();
  for (const raw of existing) {
    if (!raw) continue;
    used.add(raw.toUpperCase());
    if (/^\d{1,7}$/.test(raw)) max = Math.max(max, Number(raw));
  }
  let next = max + 1;
  while (used.has(String(next))) next++;
  return String(next);
}
