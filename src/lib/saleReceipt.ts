/**
 * Lo que dice el comprobante de venta que se le manda por correo al cliente, sin el dibujo del PDF
 * (eso está en src/lib/saleReceiptPdf.ts). Sin dependencias, para poder probarlo solo.
 */

export type InvoiceEmailStatus = "" | "pendiente" | "enviado" | "fallido";

/** Lo que el panel necesita saber de la factura de una venta (listado, detalle del cliente). */
export interface SaleInvoiceSummary {
  customerName: string;
  email: string;
  status: InvoiceEmailStatus;
  sentAt: string | null;
  outdated: boolean;
  error: string;
}

interface InvoiceLike {
  kind?: string;
  customer?: { name?: string; email?: string };
  emailStatus?: string;
  emailSentAt?: Date | string | null;
  outdated?: boolean;
  emailError?: string;
}

/** null si la venta no lleva factura. */
export function summarizeInvoice(inv: InvoiceLike | null | undefined): SaleInvoiceSummary | null {
  if (!inv?.kind) return null;
  const status = (["pendiente", "enviado", "fallido"] as const).find((s) => s === inv.emailStatus) ?? "";
  return {
    customerName: inv.customer?.name ?? "",
    email: inv.customer?.email ?? "",
    status,
    sentAt: inv.emailSentAt ? new Date(inv.emailSentAt).toISOString() : null,
    outdated: !!inv.outdated,
    error: inv.emailError ?? "",
  };
}

export interface ReceiptTotalsInput {
  subtotal: number;
  serviceAmount?: number;
  serviceRate?: number;
  ivaAmount?: number;
  ivaRate?: number;
  deliveryFee?: number;
  tipAmount?: number;
  total: number;
}

export interface ReceiptTotalRow {
  label: string;
  amount: number;
  strong?: boolean;
}

/**
 * Filas de totales. Solo aparece lo que la venta cobró: el IVA sale únicamente si se cobró, que es
 * lo correcto para el régimen simplificado (ahí el IVA va incluido en el precio y no se desglosa).
 */
export function receiptTotalRows(s: ReceiptTotalsInput): ReceiptTotalRow[] {
  const rows: ReceiptTotalRow[] = [{ label: "Subtotal", amount: s.subtotal }];
  if ((s.serviceAmount ?? 0) > 0) rows.push({ label: `Servicio (${s.serviceRate ?? 10} %)`, amount: s.serviceAmount! });
  if ((s.ivaAmount ?? 0) > 0) rows.push({ label: `IVA (${s.ivaRate ?? 13} %)`, amount: s.ivaAmount! });
  if ((s.deliveryFee ?? 0) > 0) rows.push({ label: "Envío", amount: s.deliveryFee! });
  if ((s.tipAmount ?? 0) > 0) rows.push({ label: "Propina", amount: s.tipAmount! });
  rows.push({ label: "Total", amount: s.total, strong: true });
  return rows;
}

/** El régimen como lo escribió el negocio en Configuración ("Régimen Simplificado", "simplificado"...). */
export function isSimplifiedRegime(regime: string): boolean {
  return String(regime ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("simplificad");
}

/** Número del comprobante: el mismo del tiquete, con su prefijo. */
export function receiptLabel(prefix: string, ticketNumber: number): string {
  return `${prefix ?? ""}${ticketNumber}`;
}

/** Leyendas del pie. Siempre dice que no es comprobante electrónico; el régimen, si es simplificado. */
export function receiptFooterLines(regime: string): string[] {
  const lines: string[] = [];
  if (isSimplifiedRegime(regime)) lines.push("Contribuyente del Régimen de Tributación Simplificada.");
  lines.push("Este documento no es un comprobante electrónico de Hacienda.");
  return lines;
}

/**
 * Monto para el PDF: dos decimales, sin el símbolo ₡ (las tipografías estándar del PDF no lo
 * tienen) y con espacios normales de millares en vez de los finos, que salen como signos raros.
 */
export function pdfAmount(n: number): string {
  const v = Math.round((n ?? 0) * 100) / 100;
  const abs = Math.abs(v)
    .toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ");
  return `${v < 0 ? "-" : ""}${abs}`;
}

const CR_TZ = "America/Costa_Rica";

/** Fecha y hora de Costa Rica aunque el servidor corra en UTC. */
export function crDateTimeLabel(d: Date | string): string {
  const date = new Date(d);
  const day = date.toLocaleDateString("es-CR", { timeZone: CR_TZ, day: "2-digit", month: "long", year: "numeric" });
  const time = date
    .toLocaleTimeString("es-CR", { timeZone: CR_TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/[  ]/g, " ");
  return `${day}, ${time}`;
}
