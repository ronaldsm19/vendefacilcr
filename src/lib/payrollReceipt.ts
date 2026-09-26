import type { jsPDF } from "jspdf";
import { PAY_METHOD_LABELS, numberToWords, type PaymentView } from "@/lib/payroll";

/**
 * Comprobante de pago al personal, en A4.
 *
 * Tiene que verse serio —la empleada lo guarda y a veces lo enseña— sin fingir que es un
 * documento tributario. Por eso lleva el aviso al pie: no es una factura electrónica.
 *
 * Se usa jsPDF con las tipografías estándar, igual que src/lib/ticket.ts. Esas fuentes llevan
 * bien las tildes y la ñ (WinAnsi), pero NO tienen el glifo del colón: ₡ sale impreso como
 * "¡". Por eso acá los montos van sin símbolo y la moneda se dice una vez, en el encabezado
 * de la columna — el mismo criterio que ya usan los tiquetes térmicos.
 */

const W = 210;
const H = 297;
const M = 18;

export interface ReceiptBusiness {
  name: string;
  slug: string;
}

function line(doc: jsPDF, y: number) {
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
}
function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Monto para el PDF: sin el símbolo del colón, con guion normal en vez del menos tipográfico
 * y con espacio simple de millares. Todo lo que no está en WinAnsi sale como un signo raro.
 */
function pdfMoney(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v).toLocaleString("es-CR").replace(/ | /g, " ");
  return `${v < 0 ? "-" : ""}${abs}`;
}

export async function buildPayrollReceipt(
  payment: PaymentView,
  business: ReceiptBusiness
): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc: jsPDF = new JsPDF({ unit: "mm", format: "a4" });

  let y = M;

  // ── Encabezado ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 46);
  doc.text(business.name || "Negocio", M, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Comprobante de pago al personal", M, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`N.º ${payment._id.slice(-8).toUpperCase()}`, W - M, y, { align: "right" });
  doc.text(fmtDate(payment.paidAt), W - M, y + 5, { align: "right" });

  y += 14;
  line(doc, y);
  y += 8;

  // ── Persona y período ──
  doc.setTextColor(120);
  doc.setFontSize(9);
  doc.text("Pagado a", M, y);
  doc.text("Período", W / 2, y);

  doc.setTextColor(26, 26, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(payment.staffName, M, y + 6);
  doc.text(`${fmtShortDate(payment.periodFrom)} — ${fmtShortDate(payment.periodTo)}`, W / 2, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(payment.staffRole === "cajero" ? "Cajero" : "Mesero", M, y + 11);

  y += 20;

  // ── Turnos ──
  const shifts = payment.shifts ?? [];
  if (shifts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 46);
    doc.text("Horas trabajadas", M, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Fecha", M, y);
    doc.text("Entrada", M + 55, y);
    doc.text("Salida", M + 85, y);
    doc.text("Horas", W - M, y, { align: "right" });
    y += 2;
    line(doc, y);
    y += 5;

    doc.setTextColor(60);
    // Con muchos turnos el detalle no cabe: se resume en vez de desbordar la página.
    const MAX_ROWS = 26;
    const rows = shifts.slice(0, MAX_ROWS);
    for (const s of rows) {
      doc.text(fmtShortDate(s.startedAt), M, y);
      doc.text(fmtTime(s.startedAt), M + 55, y);
      doc.text(fmtTime(s.endedAt), M + 85, y);
      doc.text(hours(s.minutes), W - M, y, { align: "right" });
      y += 5;
    }
    if (shifts.length > MAX_ROWS) {
      doc.setTextColor(140);
      doc.text(`… y ${shifts.length - MAX_ROWS} turnos más`, M, y);
      y += 5;
    }

    line(doc, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    doc.text(`Total: ${hours(payment.basis.minutes)}`, W - M, y, { align: "right" });
    y += 10;
  }

  // ── Desglose ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 46);
  doc.text("Desglose", M, y);
  // La moneda se dice acá una vez, porque el símbolo ₡ no existe en estas tipografías.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("Montos en colones (CRC)", W - M, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const l of payment.lines) {
    doc.setTextColor(60);
    doc.text(l.label, M, y);
    doc.setTextColor(l.amount < 0 ? 185 : 60, l.amount < 0 ? 28 : 60, l.amount < 0 ? 28 : 60);
    doc.text(pdfMoney(l.amount), W - M, y, { align: "right" });
    y += 6;
  }

  line(doc, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 46);
  doc.text("Total pagado", M, y);
  doc.text(pdfMoney(payment.total), W - M, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const words = numberToWords(payment.total);
  doc.text(words.charAt(0).toUpperCase() + words.slice(1), M, y);
  y += 10;

  // ── Forma de pago ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Forma de pago", M, y);
  doc.setTextColor(60);
  doc.text(PAY_METHOD_LABELS[payment.method], M + 32, y);
  if (payment.reference) {
    doc.setTextColor(120);
    doc.text("Referencia", M + 90, y);
    doc.setTextColor(60);
    doc.text(payment.reference, M + 115, y);
  }
  y += 6;

  if (payment.notes) {
    doc.setTextColor(120);
    doc.text("Nota", M, y);
    doc.setTextColor(60);
    doc.text(doc.splitTextToSize(payment.notes, W - M * 2 - 32) as string[], M + 32, y);
    y += 8;
  }

  if (payment.voidedAt) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(185, 28, 28);
    doc.text(`ANULADO — ${payment.voidReason}`, M, y);
    y += 8;
  }

  // ── Firmas, ancladas abajo ──
  const signY = H - M - 28;
  doc.setDrawColor(160);
  doc.setLineWidth(0.2);
  doc.line(M, signY, M + 65, signY);
  doc.line(W - M - 65, signY, W - M, signY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Recibido conforme", M, signY + 5);
  doc.text(payment.staffName, M, signY + 10);
  doc.text("Entregado por", W - M - 65, signY + 5);
  doc.text(payment.createdByName || business.name, W - M - 65, signY + 10);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    "Comprobante interno de pago. No es una factura electrónica ni un documento tributario.",
    W / 2,
    H - M,
    { align: "center" }
  );

  return doc;
}

/** Nombre de archivo estable y legible. */
export function receiptFilename(payment: PaymentView): string {
  const name = payment.staffName.trim().replace(/\s+/g, "-").toLowerCase();
  const date = payment.paidAt.slice(0, 10);
  return `pago-${name}-${date}.pdf`;
}
