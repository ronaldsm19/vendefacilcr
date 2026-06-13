// Generador de tickets en PDF con formato térmico (80mm, monoespaciado).
// Se usa en el POS (venta), Cierre de caja, y como preview en vivo en Configuración.
//
// Nota: se formatean montos SIN el símbolo ₡ porque las fuentes estándar de PDF
// (Courier/Helvetica, codificación WinAnsi) no incluyen el glifo del colón.
// Igual que en los tickets térmicos reales: solo el número con 2 decimales.

import type { jsPDF } from "jspdf";

// ── Modelo de filas del ticket ────────────────────────────────────
export type Row =
  | { t: "center"; text: string; bold?: boolean; size?: number }
  | { t: "left"; text: string; bold?: boolean; size?: number }
  | { t: "lr"; left: string; right: string; bold?: boolean }
  | { t: "divider" }
  | { t: "gap" };

const W = 80;          // ancho de página (mm) — rollo térmico estándar
const ML = 5;          // margen izquierdo
const MR = 5;          // margen derecho
const LH = 4.4;        // alto de línea (mm)
const BASE_SIZE = 9;

function money(n: number): string {
  return (n ?? 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
}

/** Trunca una cadena para que no exceda el ancho disponible en monoespaciado. */
function clip(s: string, maxChars: number): string {
  return s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s;
}

/** Arma una fila de tabla con columnas de ancho fijo (monoespaciado, ~36 cols a 9pt/80mm). */
function padCols(cols: { text: string; width: number; align?: "l" | "r" }[]): string {
  return cols
    .map(({ text, width, align }) => {
      const t = clip(text, width);
      return align === "r" ? t.padStart(width, " ") : t.padEnd(width, " ");
    })
    .join("");
}

/** Construye el PDF a partir de las filas y lo abre en una pestaña nueva. */
async function render(rows: Row[], filename: string) {
  const { jsPDF: JsPDF } = await import("jspdf");

  // Altura dinámica: cada fila ocupa una línea (gap = media línea).
  const units = rows.reduce((sum, r) => sum + (r.t === "gap" ? 0.5 : 1), 0);
  const height = 6 + units * LH + 8;

  const doc: jsPDF = new JsPDF({ unit: "mm", format: [W, height] });

  let y = 6;
  for (const r of rows) {
    if (r.t === "gap") { y += LH * 0.5; continue; }

    if (r.t === "divider") {
      doc.setLineWidth(0.1);
      doc.setDrawColor(120);
      doc.line(ML, y - 1.4, W - MR, y - 1.4);
      y += LH;
      continue;
    }

    const size = ("size" in r && r.size) ? r.size : BASE_SIZE;
    const bold = "bold" in r ? r.bold : false;
    doc.setFont("courier", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(20);

    if (r.t === "center") {
      doc.text(r.text, W / 2, y, { align: "center" });
    } else if (r.t === "left") {
      doc.text(r.text, ML, y);
    } else {
      // label izquierda + valor derecha
      doc.text(r.left, ML, y);
      doc.text(r.right, W - MR, y, { align: "right" });
    }
    y += LH;
  }

  const url = doc.output("bloburl");
  window.open(url, "_blank");
}

// ── Configuración del "Ticket electrónico" del tenant ─────────────
export interface TicketConfigData {
  businessName: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  ownerName: string;
  taxId: string;
  taxRegime: string;
  footerMessage: string;
  terminalNumber: string;
  ticketPrefix: string;
}

export const DEFAULT_TICKET_CONFIG: TicketConfigData = {
  businessName: "",
  location: "",
  address: "",
  phone: "",
  email: "",
  ownerName: "",
  taxId: "",
  taxRegime: "Régimen Simplificado",
  footerMessage: "¡Gracias por su compra!",
  terminalNumber: "1",
  ticketPrefix: "",
};

const METHOD_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  sinpe: "SINPE",
  tarjeta: "Tarjeta",
  mixto: "Mixto",
};

// ── Ticket de VENTA ───────────────────────────────────────────────
export interface SaleTicketData {
  businessName: string;
  ticketNumber?: number;
  saleNumber: string; // fallback (código corto) cuando no hay ticketNumber
  date: Date | string;
  cashUserName?: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: "LOCAL" | "PICKUP" | "EXPRESS";
  pickupTime?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryFee?: number;
  items: { productName: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  ivaEnabled?: boolean; ivaRate?: number; ivaAmount?: number;
  serviceEnabled?: boolean; serviceRate?: number; serviceAmount?: number;
  tipEnabled?: boolean; tipAmount?: number;
  total: number;
  paymentMethod: "efectivo" | "sinpe" | "tarjeta" | "mixto" | string;
  mixedPayment?: { efectivo: number; sinpe: number; tarjeta: number };
  amountPaid?: number;
  changeGiven?: number;
  notes?: string;
}

export function buildSaleRows(d: SaleTicketData, cfg: TicketConfigData = DEFAULT_TICKET_CONFIG): Row[] {
  const rows: Row[] = [];
  const ticketLabel = d.ticketNumber ? `${cfg.ticketPrefix}${d.ticketNumber}` : `#${d.saleNumber}`;

  // Encabezado con datos del negocio
  rows.push({ t: "center", text: cfg.businessName || d.businessName, bold: true, size: 12 });
  if (cfg.location) rows.push({ t: "center", text: cfg.location, size: 8 });
  if (cfg.address)  rows.push({ t: "center", text: cfg.address, size: 8 });
  if (cfg.phone)    rows.push({ t: "center", text: `Tel: ${cfg.phone}`, size: 8 });
  if (cfg.email)    rows.push({ t: "center", text: cfg.email, size: 8 });
  if (cfg.ownerName || cfg.taxId) {
    const parts = [cfg.ownerName, cfg.taxId ? `Céd: ${cfg.taxId}` : ""].filter(Boolean);
    rows.push({ t: "center", text: parts.join(" - "), size: 8 });
  }
  rows.push({ t: "divider" });

  rows.push({ t: "lr", left: "Factura:", right: ticketLabel });
  rows.push({ t: "lr", left: "Fecha:", right: fmtDate(d.date) });
  rows.push({ t: "lr", left: "Hora:", right: fmtTime(d.date) });
  if (d.cashUserName) rows.push({ t: "lr", left: "Encargado:", right: clip(d.cashUserName, 20) });
  if (d.customerName) rows.push({ t: "lr", left: "Cliente:", right: clip(d.customerName, 20) });
  if (d.tableNumber)  rows.push({ t: "lr", left: "Mesa:", right: clip(d.tableNumber, 20) });
  if (d.orderType === "PICKUP") {
    rows.push({ t: "lr", left: "Tipo:", right: "Para llevar" });
    if (d.pickupTime) rows.push({ t: "lr", left: "Recogida:", right: d.pickupTime });
  }
  if (d.orderType === "EXPRESS") {
    rows.push({ t: "lr", left: "Tipo:", right: "Express" });
    if (d.deliveryAddress) rows.push({ t: "left", text: clip(`Dir: ${d.deliveryAddress}`, 36), size: 8 });
    if (d.deliveryPhone)   rows.push({ t: "lr", left: "Tel:", right: d.deliveryPhone });
  }
  rows.push({ t: "divider" });

  // Tabla de productos: Uds | Descripción | P.U. | Total
  rows.push({
    t: "left",
    bold: true,
    size: 8,
    text: padCols([
      { text: "Uds", width: 3 },
      { text: "Descripción", width: 15 },
      { text: "P.U.", width: 8, align: "r" },
      { text: "Total", width: 10, align: "r" },
    ]),
  });
  for (const it of d.items) {
    rows.push({
      t: "left",
      size: 8,
      text: padCols([
        { text: String(it.quantity), width: 3 },
        { text: it.productName, width: 15 },
        { text: money(it.unitPrice), width: 8, align: "r" },
        { text: money(it.lineTotal), width: 10, align: "r" },
      ]),
    });
  }
  rows.push({ t: "divider" });

  rows.push({ t: "lr", left: "SubTotal", right: money(d.subtotal) });
  if ((d.deliveryFee ?? 0) > 0)
    rows.push({ t: "lr", left: "Envio", right: money(d.deliveryFee ?? 0) });
  if (d.ivaEnabled && (d.ivaAmount ?? 0) > 0)
    rows.push({ t: "lr", left: `IVA (${d.ivaRate ?? 0}%)`, right: money(d.ivaAmount ?? 0) });
  if (d.serviceEnabled && (d.serviceAmount ?? 0) > 0)
    rows.push({ t: "lr", left: `Servicio (${d.serviceRate ?? 0}%)`, right: money(d.serviceAmount ?? 0) });
  if (d.tipEnabled && (d.tipAmount ?? 0) > 0)
    rows.push({ t: "lr", left: "Propina", right: money(d.tipAmount ?? 0) });
  rows.push({ t: "divider" });
  rows.push({ t: "lr", left: "TOTAL", right: money(d.total), bold: true });

  // Desglose de impuestos REALMENTE aplicados: Tipo Imp | Base | Cuota
  const hasIva = !!(d.ivaEnabled && (d.ivaAmount ?? 0) > 0);
  const hasService = !!(d.serviceEnabled && (d.serviceAmount ?? 0) > 0);
  if (hasIva || hasService) {
    rows.push({ t: "divider" });
    rows.push({
      t: "left",
      bold: true,
      size: 8,
      text: padCols([
        { text: "Tipo Imp", width: 14 },
        { text: "Base", width: 11, align: "r" },
        { text: "Cuota", width: 11, align: "r" },
      ]),
    });
    if (hasIva) {
      rows.push({
        t: "left",
        size: 8,
        text: padCols([
          { text: `IVA ${d.ivaRate ?? 0}%`, width: 14 },
          { text: money(d.subtotal), width: 11, align: "r" },
          { text: money(d.ivaAmount ?? 0), width: 11, align: "r" },
        ]),
      });
    }
    if (hasService) {
      rows.push({
        t: "left",
        size: 8,
        text: padCols([
          { text: `Serv ${d.serviceRate ?? 0}%`, width: 14 },
          { text: money(d.subtotal), width: 11, align: "r" },
          { text: money(d.serviceAmount ?? 0), width: 11, align: "r" },
        ]),
      });
    }
    rows.push({ t: "divider" });
  } else {
    rows.push({ t: "gap" });
  }

  if ((d.amountPaid ?? 0) > 0 && d.paymentMethod === "efectivo") {
    rows.push({ t: "gap" });
    rows.push({ t: "lr", left: "Recibido", right: money(d.amountPaid ?? 0) });
    rows.push({ t: "lr", left: "Vuelto", right: money(d.changeGiven ?? 0), bold: true });
  }
  rows.push({ t: "center", text: `Forma de pago: ${METHOD_LABEL[d.paymentMethod] ?? d.paymentMethod}` });
  if (d.paymentMethod === "mixto" && d.mixedPayment) {
    for (const m of ["efectivo", "sinpe", "tarjeta"] as const) {
      if ((d.mixedPayment[m] ?? 0) > 0)
        rows.push({ t: "center", text: `${METHOD_LABEL[m]}: ${money(d.mixedPayment[m])}`, size: 8 });
    }
  }

  if (d.notes) {
    rows.push({ t: "divider" });
    rows.push({ t: "left", text: "Observaciones:", bold: true, size: 8 });
    rows.push({ t: "left", text: clip(d.notes, 36), size: 8 });
  }

  if (cfg.taxRegime) rows.push({ t: "center", text: cfg.taxRegime, size: 7 });
  rows.push({ t: "center", text: cfg.footerMessage || "¡Gracias por su compra!", size: 8 });
  rows.push({ t: "center", text: `Pedido ${ticketLabel}`, size: 7 });
  rows.push({ t: "center", text: "Generado con VendeFácil CR", size: 7 });

  return rows;
}

export async function saleTicket(d: SaleTicketData, cfg: TicketConfigData = DEFAULT_TICKET_CONFIG) {
  const filename = d.ticketNumber ? `ticket-venta-${cfg.ticketPrefix}${d.ticketNumber}.pdf` : `ticket-venta-${d.saleNumber}.pdf`;
  await render(buildSaleRows(d, cfg), filename);
}

// ── Ticket de CIERRE DE CAJA ──────────────────────────────────────
export interface CashCloseTicketData {
  businessName: string;
  closeNumber: string | number;
  date: Date | string;
  closedBy?: string;
  paymentBreakdown: { efectivo: number; sinpe: number; tarjeta: number };
  salesTotal: number;
  expensesTotal: number;
  profit: number;
  arqueo?: { totalContado: number; totalEsperado: number; diferencia: number };
  productsSummary?: { productName: string; unitsSold: number }[];
  openingAmount?: number;
  withdrawals?: { amount: number; leftAmount: number; note?: string; date: Date | string }[];
  withdrawalsTotal?: number;
  cashLeft?: number;
  salesList?: { ticketNumber: number; total: number }[];
  notes?: string;
}

export function buildCashCloseRows(d: CashCloseTicketData, cfg: TicketConfigData = DEFAULT_TICKET_CONFIG): Row[] {
  const rows: Row[] = [];

  const openingAmount = d.openingAmount ?? 0;
  const withdrawals = d.withdrawals ?? [];
  const withdrawalsTotal = d.withdrawalsTotal ?? withdrawals.reduce((s, w) => s + (w.amount ?? 0), 0);
  const cashLeft = d.cashLeft ?? 0;
  const salesList = d.salesList ?? [];
  const ingresosTotal = openingAmount + d.salesTotal;
  const salidasTotal = d.expensesTotal + withdrawalsTotal;
  const totalGeneral = ingresosTotal - salidasTotal;

  rows.push({ t: "center", text: cfg.businessName || d.businessName, bold: true, size: 12 });
  if (cfg.address) rows.push({ t: "center", text: cfg.address, size: 8 });
  if (d.closedBy) rows.push({ t: "center", text: `Empleado: ${clip(d.closedBy, 24)}`, size: 8 });
  rows.push({ t: "divider" });

  rows.push({ t: "left", text: "Ventas Detalladas", bold: true });
  rows.push({ t: "left", text: `Desde ${fmtDate(d.date)} a ${fmtDate(d.date)}`, size: 8 });
  rows.push({ t: "lr", left: "Hora:", right: fmtTime(d.date) });
  rows.push({ t: "lr", left: "Terminal:", right: cfg.terminalNumber || "1" });
  rows.push({ t: "lr", left: "Nro. Cierre:", right: String(d.closeNumber) });
  rows.push({ t: "divider" });

  // INGRESOS
  rows.push({ t: "left", text: "INGRESOS", bold: true });
  rows.push({ t: "lr", left: "  C.Inicial", right: money(openingAmount) });
  for (const s of salesList) {
    rows.push({ t: "lr", left: `  #${s.ticketNumber || "-"}`, right: money(s.total) });
  }
  rows.push({ t: "divider" });
  rows.push({ t: "lr", left: "  Total", right: money(ingresosTotal), bold: true });
  rows.push({ t: "divider" });

  // SALIDAS
  rows.push({ t: "left", text: "SALIDAS", bold: true });
  rows.push({ t: "lr", left: "  Gastos", right: money(d.expensesTotal) });
  if (withdrawals.length > 0) {
    for (const w of withdrawals) {
      const label = clip(`  Retiro ${fmtTime(w.date)}`, 22);
      rows.push({ t: "lr", left: label, right: money(w.amount) });
      if (w.note) rows.push({ t: "left", text: clip(`    ${w.note}`, 34), size: 7 });
    }
    rows.push({ t: "lr", left: "  Total retiros", right: money(withdrawalsTotal) });
  } else {
    rows.push({ t: "lr", left: "  Retiradas", right: money(withdrawalsTotal) });
  }
  rows.push({ t: "divider" });
  rows.push({ t: "lr", left: "  Total", right: money(salidasTotal), bold: true });
  rows.push({ t: "divider" });

  // RECTIFICADAS (no existe el concepto en el sistema; se muestra en 0 por fidelidad visual)
  rows.push({ t: "left", text: "RECTIFICADAS", bold: true });
  rows.push({ t: "lr", left: "  Total", right: money(0) });
  rows.push({ t: "divider" });

  rows.push({ t: "lr", left: "T.GENERAL", right: money(totalGeneral), bold: true });
  rows.push({ t: "divider" });

  // POR FORMAS DE PAGO
  rows.push({ t: "left", text: "POR FORMAS DE PAGO", bold: true });
  rows.push({ t: "lr", left: "  C.Inicial", right: money(openingAmount) });
  rows.push({ t: "lr", left: "  Efectivo", right: money(d.paymentBreakdown.efectivo) });
  rows.push({ t: "lr", left: "  SINPE", right: money(d.paymentBreakdown.sinpe) });
  rows.push({ t: "lr", left: "  Tarjeta", right: money(d.paymentBreakdown.tarjeta) });
  rows.push({ t: "divider" });

  // CONTEO TURNO ACTUAL
  rows.push({ t: "left", text: "CONTEO TURNO ACTUAL", bold: true });
  if (d.arqueo) {
    const diferencia = d.arqueo.diferencia;
    rows.push({ t: "lr", left: "  Contado", right: money(d.arqueo.totalContado) });
    rows.push({ t: "lr", left: "  Dejo en caja", right: money(cashLeft) });
    rows.push({ t: "lr", left: "  Diferencia", right: `${diferencia > 0 ? "+" : ""}${money(diferencia)}` });
    rows.push({ t: "lr", left: "  T. Descuadre", right: money(Math.abs(diferencia)), bold: true });
  } else {
    rows.push({ t: "lr", left: "  Dejo en caja", right: money(cashLeft) });
  }
  rows.push({ t: "divider" });

  rows.push({ t: "lr", left: "GANANCIA NETA", right: money(d.profit), bold: true });

  const sold = (d.productsSummary ?? []).filter((p) => p.unitsSold > 0);
  if (sold.length) {
    rows.push({ t: "divider" });
    rows.push({ t: "left", text: "PRODUCTOS VENDIDOS", bold: true });
    for (const p of sold) {
      rows.push({ t: "lr", left: clip(`  ${p.productName}`, 26), right: `${p.unitsSold} und` });
    }
  }

  rows.push({ t: "divider" });
  rows.push({ t: "left", text: "Observaciones:", bold: true });
  rows.push({ t: "left", text: clip(d.notes || "Ninguna", 36), size: 8 });

  rows.push({ t: "divider" });
  rows.push({ t: "center", text: cfg.footerMessage || "¡Gracias por su compra!", size: 8 });
  rows.push({ t: "center", text: "Generado con VendeFácil CR", size: 7 });

  return rows;
}

export async function cashCloseTicket(d: CashCloseTicketData, cfg: TicketConfigData = DEFAULT_TICKET_CONFIG) {
  await render(buildCashCloseRows(d, cfg), `cierre-${d.closeNumber}.pdf`);
}
