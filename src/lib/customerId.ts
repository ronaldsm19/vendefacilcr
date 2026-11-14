/**
 * Identificación de los clientes que piden factura. Los códigos son los de Hacienda (los mismos que
 * pide el comprobante electrónico 4.4 en el receptor), para que la fase de factura electrónica los
 * use tal cual sin traducir nada.
 *
 * Sin dependencias: lo usan el modelo, las rutas y el formulario del panel.
 */

export const ID_TYPES = ["01", "02", "03", "04"] as const;
export type IdType = (typeof ID_TYPES)[number];

export const ID_TYPE_LABELS: Record<IdType, string> = {
  "01": "Cédula física",
  "02": "Cédula jurídica",
  "03": "DIMEX",
  "04": "NITE",
};

export function isIdType(value: unknown): value is IdType {
  return typeof value === "string" && (ID_TYPES as readonly string[]).includes(value);
}

/** Solo los dígitos: la caja escribe "3-101-123456" o "1 2345 6789" y se guarda sin separadores. */
export function normalizeIdNumber(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** null si el número sirve para ese tipo; si no, el mensaje para mostrar. Recibe el número ya normalizado. */
export function idNumberError(type: IdType, digits: string): string | null {
  if (!digits) return "Escribí el número de identificación";
  switch (type) {
    case "01":
      return /^\d{9}$/.test(digits) ? null : "La cédula física tiene 9 dígitos (por ejemplo 1-2345-6789)";
    case "02":
      return /^3\d{9}$/.test(digits) ? null : "La cédula jurídica tiene 10 dígitos y empieza con 3 (por ejemplo 3-101-123456)";
    case "03":
      return /^\d{11,12}$/.test(digits) ? null : "El DIMEX tiene 11 o 12 dígitos";
    case "04":
      return /^\d{10}$/.test(digits) ? null : "El NITE tiene 10 dígitos";
  }
}

/**
 * El tipo más probable para un número escrito, mientras Hacienda no diga otra cosa. 9 dígitos es
 * física; 10 que empiezan con 3, jurídica; 11 o 12, DIMEX. Un NITE (10 dígitos) se elige a mano.
 */
export function guessIdType(digits: string): IdType | null {
  if (/^\d{9}$/.test(digits)) return "01";
  if (/^3\d{9}$/.test(digits)) return "02";
  if (/^\d{11,12}$/.test(digits)) return "03";
  return null;
}

/** Para mostrar: 1-2345-6789 y 3-101-123456. DIMEX y NITE van corridos. */
export function formatIdNumber(type: IdType, digits: string): string {
  if (type === "01" && /^\d{9}$/.test(digits)) return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5)}`;
  if (type === "02" && /^\d{10}$/.test(digits)) return `${digits[0]}-${digits.slice(1, 4)}-${digits.slice(4)}`;
  return digits;
}

/** Minúsculas y sin tildes, para que "Jose" encuentre a "José". */
export function searchKey(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Un cliente como viaja al panel (sin tenantId ni la clave interna de búsqueda). */
export interface CustomerView {
  _id: string;
  idType: IdType;
  idNumber: string;
  name: string;
  email: string;
  ccEmails: string[];
  phone: string;
  activityCode: string;
  activityName: string;
  haciendaRegime: string;
  notes: string;
  invoiceCount: number;
  createdBy: string;
  lastInvoiceAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const EMAIL_RE =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 160;
}
