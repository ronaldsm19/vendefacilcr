import type { jsPDF } from "jspdf";
import { ticketItemRows, type SaleTicketItem } from "@/lib/ticket";
import { PAYMENT_METHOD_LABELS, SPLIT_METHODS, isPaymentMethod } from "@/lib/payments";
import { ID_TYPE_LABELS, formatIdNumber, isIdType } from "@/lib/customerId";
import { crDateTimeLabel, pdfAmount, receiptFooterLines, receiptTotalRows } from "@/lib/saleReceipt";

/**
 * Comprobante de venta en A4 para mandarlo por correo al cliente que pidió factura. Se arma en el
 * servidor con jsPDF y las tipografías estándar, igual que el comprobante de planilla: llevan bien
 * tildes y eñes, pero no el glifo ₡, así que los montos van sin símbolo y la moneda se dice una vez.
 *
 * No es factura electrónica y lo dice al pie. Para el régimen simplificado es justo lo que corresponde;
 * para el tradicional sirve de respaldo hasta que se emita por API.
 */

const W = 210;
const H = 297;
const M = 18;
const DARK: [number, number, number] = [26, 26, 46];

export interface SaleReceiptBusiness {
  name: string;
  taxId: string;
  regime: string;
  address: string;
  location: string;
  phone: string;
  email: string;
}

export interface SaleReceiptCustomer {
  idType: string;
  idNumber: string;
  name: string;
  email: string;
}

export interface SaleReceiptData {
  business: SaleReceiptBusiness;
  customer: SaleReceiptCustomer;
  receiptLabel: string;
  date: Date | string;
  items: SaleTicketItem[];
  subtotal: number;
  serviceAmount?: number;
  serviceRate?: number;
  ivaAmount?: number;
  ivaRate?: number;
  deliveryFee?: number;
  tipAmount?: number;
  total: number;
  paymentMethod: string;
  mixedPayment?: { efectivo: number; sinpe: number; tarjeta: number };
  orderType?: "LOCAL" | "PICKUP" | "EXPRESS";
  tableNumber?: string;
  cashUserName?: string;
}

function rule(doc: jsPDF, y: number) {
  doc.setDrawColor(210);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
}

function idLine(idType: string, idNumber: string): string {
  if (!idNumber) return "";
  return isIdType(idType) ? `${ID_TYPE_LABELS[idType]} ${formatIdNumber(idType, idNumber)}` : idNumber;
}

function paymentText(method: string, mixed?: SaleReceiptData["mixedPayment"]): string {
  if (method === "mixto" && mixed) {
    const parts = SPLIT_METHODS.filter((m) => (mixed[m] ?? 0) > 0).map((m) => `${PAYMENT_METHOD_LABELS[m]} ${pdfAmount(mixed[m])}`);
    return parts.length ? `Mixto: ${parts.join(" + ")}` : "Mixto";
  }
  return isPaymentMethod(method) ? PAYMENT_METHOD_LABELS[method] : method;
}

function orderText(d: SaleReceiptData): string {
  if (d.orderType === "EXPRESS") return "Express";
  if (d.orderType === "PICKUP") return "Para llevar";
  return d.tableNumber ? `Mesa ${d.tableNumber}` : "En el local";
}

export async function buildSaleReceiptPdf(d: SaleReceiptData): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc: jsPDF = new JsPDF({ unit: "mm", format: "a4" });
  const b = d.business;

  // ── Encabezado: el negocio a la izquierda, el comprobante a la derecha ──
  let y = M + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...DARK);
  const nameLines = doc.splitTextToSize(b.name || "Negocio", 105) as string[];
  doc.text(nameLines, M, y);
  let left = y + nameLines.length * 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const businessLines = [
    b.taxId ? `Cédula ${b.taxId}` : "",
    [b.address, b.location].filter(Boolean).join(", "),
    [b.phone, b.email].filter(Boolean).join("  ·  "),
  ].filter(Boolean);
  for (const l of businessLines) {
    const wrapped = doc.splitTextToSize(l, 105) as string[];
    doc.text(wrapped, M, left);
    left += wrapped.length * 4.5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("COMPROBANTE DE VENTA", W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`N.º ${d.receiptLabel}`, W - M, y + 6, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(crDateTimeLabel(d.date), W - M, y + 11, { align: "right" });

  y = Math.max(left, y + 14) + 3;
  rule(doc, y);
  y += 8;

  // ── Cliente ──
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text("Cliente", M, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  const custLines = doc.splitTextToSize(d.customer.name, W - M * 2) as string[];
  doc.text(custLines, M, y + 6);
  y += 6 + custLines.length * 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  const custMeta = [idLine(d.customer.idType, d.customer.idNumber), d.customer.email].filter(Boolean).join("  ·  ");
  if (custMeta) { doc.text(custMeta, M, y); y += 5; }
  y += 5;

  // ── Detalle ──
  const COL_QTY = M;
  const COL_DESC = M + 16;
  const COL_UNIT = W - M - 32;
  const COL_TOTAL = W - M;
  // El precio va alineado a la derecha en COL_UNIT y ocupa hasta ~25 mm hacia la izquierda.
  const DESC_W = COL_UNIT - COL_DESC - 30;

  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Cant.", COL_QTY, y);
    doc.text("Descripción", COL_DESC, y);
    doc.text("Precio", COL_UNIT, y, { align: "right" });
    doc.text("Total", COL_TOTAL, y, { align: "right" });
    y += 2;
    rule(doc, y);
    y += 5;
  };
  header();

  doc.setFont("helvetica", "normal");
  for (const r of ticketItemRows(d.items)) {
    // El corte de línea depende del tamaño de letra: se fija antes de medir.
    doc.setFontSize(r.isExtra ? 9 : 10);
    const desc = doc.splitTextToSize(r.isExtra ? `+ ${r.name}` : r.name, DESC_W) as string[];
    const rowH = desc.length * 4.6 + 1.2;
    // Queda espacio abajo para totales y pie; si no cabe, sigue en otra página.
    if (y + rowH > H - 40) {
      doc.addPage();
      y = M + 4;
      header();
      doc.setFont("helvetica", "normal");
    }
    doc.setFontSize(r.isExtra ? 9 : 10);
    doc.setTextColor(r.isExtra ? 110 : 50);
    doc.text(String(r.quantity), COL_QTY, y);
    doc.text(desc, r.isExtra ? COL_DESC + 3 : COL_DESC, y);
    doc.text(pdfAmount(r.unitPrice), COL_UNIT, y, { align: "right" });
    doc.text(pdfAmount(r.total), COL_TOTAL, y, { align: "right" });
    y += rowH;
    if (r.detail) {
      doc.setFontSize(8.5);
      doc.setTextColor(120);
      doc.text(r.detail, COL_DESC, y - 0.6);
      y += 4.2;
    }
  }
  y += 1;
  rule(doc, y);
  y += 7;

  // ── Totales ──
  const totals = receiptTotalRows(d);
  if (y + totals.length * 6.5 + 30 > H - 22) { doc.addPage(); y = M + 4; }
  const LABEL_X = W - M - 70;
  for (const t of totals) {
    if (t.strong) {
      doc.setDrawColor(210);
      doc.line(LABEL_X, y - 4, W - M, y - 4);
      y += 1.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...DARK);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(70);
    }
    doc.text(t.label, LABEL_X, y);
    doc.text(pdfAmount(t.amount), W - M, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("Montos en colones (CRC)", W - M, y, { align: "right" });
  y += 9;

  // ── Pago y servicio ──
  doc.setFontSize(9);
  const info: [string, string][] = [
    ["Forma de pago", paymentText(d.paymentMethod, d.mixedPayment)],
    ["Servicio", orderText(d)],
  ];
  if (d.cashUserName) info.push(["Atendió", d.cashUserName]);
  for (const [k, v] of info) {
    doc.setTextColor(110);
    doc.text(k, M, y);
    doc.setTextColor(50);
    doc.text(doc.splitTextToSize(v, W - M * 2 - 32) as string[], M + 32, y);
    y += 5.5;
  }

  // ── Pie, en todas las páginas ──
  const footer = receiptFooterLines(b.regime);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    footer.forEach((l, i) => doc.text(l, W / 2, H - M - (footer.length - 1 - i) * 4, { align: "center" }));
    if (pages > 1) doc.text(`Página ${p} de ${pages}`, W - M, H - M, { align: "right" });
  }

  return doc;
}

/** Nombre del adjunto: comprobante-A-1234.pdf */
export function saleReceiptFilename(receiptLabel: string): string {
  return `comprobante-${receiptLabel.replace(/[^\w-]+/g, "-")}.pdf`;
}
