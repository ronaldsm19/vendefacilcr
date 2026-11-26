/**
 * Tipo real de un archivo subido, mirando sus primeros bytes. El navegador manda el tipo y el
 * nombre que quiera: sin esto, un HTML o un script etiquetado "image/png" (o con nombre .html)
 * se guardaba tal cual en el almacenamiento.
 */
export type SniffedType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";

export const EXTENSION_FOR: Record<SniffedType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif"; // GIF8
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

/** El tipo real del archivo si es uno de los permitidos; si no, null. */
export function allowedFileType(bytes: Uint8Array, allowed: readonly string[]): SniffedType | null {
  const real = sniffFileType(bytes);
  return real && allowed.includes(real) ? real : null;
}
