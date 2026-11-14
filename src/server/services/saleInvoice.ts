import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale, type ISale, type ISaleInvoice } from "@/models/Sale";
import { Customer, type ICustomer } from "@/models/Customer";
import { Tenant, type ITicketConfig } from "@/models/Tenant";
import { sendMail, saleReceiptEmailHtml } from "@/lib/email";
import { buildSaleReceiptPdf, saleReceiptFilename } from "@/lib/saleReceiptPdf";
import { crDateTimeLabel, pdfAmount, receiptLabel } from "@/lib/saleReceipt";

/**
 * Comprobante de venta por correo (fase 1 de la factura). La venta guarda una copia congelada del
 * cliente; el correo se manda después de responder al cobro, así una caída del SMTP nunca frena la
 * caja: la venta queda con el envío "fallido" y se puede reenviar.
 */

export type InvoiceSnapshot = { customerId: string; customerName: string; invoice: ISaleInvoice };

/**
 * La copia del cliente que se guarda en la venta, o null si el cliente no existe en este negocio.
 * El correo siempre está: el registro no deja guardar un cliente sin él.
 */
export async function invoiceSnapshotFor(tenantId: string, customerId: string): Promise<InvoiceSnapshot | null> {
  if (!mongoose.isValidObjectId(customerId)) return null;
  await connectToDatabase();
  const c = await Customer.findOne({ _id: customerId, tenantId }).lean<ICustomer>();
  if (!c) return null;
  return {
    customerId: String(c._id),
    customerName: c.name,
    invoice: {
      kind: "comprobante",
      customer: {
        idType: c.idType,
        idNumber: c.idNumber,
        name: c.name,
        email: c.email,
        ccEmails: c.ccEmails ?? [],
        activityCode: c.activityCode ?? "",
      },
      issuedAt: new Date(),
      emailStatus: "pendiente",
      emailSentAt: null,
      emailError: "",
      sendCount: 0,
      outdated: false,
      haciendaKey: "",
      haciendaStatus: "",
      providerId: "",
    },
  };
}

/** Suma el comprobante al contador del cliente. Un fallo acá no afecta la venta. */
export async function countInvoiceForCustomer(tenantId: string, customerId: string, at: Date): Promise<void> {
  await Customer.updateOne(
    { _id: customerId, tenantId },
    { $inc: { invoiceCount: 1 }, $max: { lastInvoiceAt: at } },
  ).catch((err) => console.error("[saleInvoice] No se pudo actualizar el contador del cliente:", err));
}

/** Al borrar una venta facturada (o pasar su factura a otro cliente). Nunca baja de cero. */
export async function uncountInvoiceForCustomer(tenantId: string, customerId: string): Promise<void> {
  await Customer.updateOne(
    { _id: customerId, tenantId, invoiceCount: { $gt: 0 } },
    { $inc: { invoiceCount: -1 } },
  ).catch((err) => console.error("[saleInvoice] No se pudo descontar la factura del cliente:", err));
}

type TenantForReceipt ={ name: string; email: string; ticketConfig?: Partial<ITicketConfig> };

/**
 * Arma el PDF y lo manda al cliente de la venta. Nunca lanza: devuelve el resultado y deja el
 * estado del envío anotado en la venta.
 */
export async function sendSaleInvoice(tenantId: string, saleId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await connectToDatabase();
    const [sale, tenant] = await Promise.all([
      Sale.findOne({ _id: saleId, tenantId }).lean<ISale>(),
      Tenant.findById(tenantId).select("name email ticketConfig").lean<TenantForReceipt>(),
    ]);
    if (!sale || !tenant) return { ok: false, error: "Venta no encontrada" };
    const inv = sale.invoice;
    if (!inv?.kind || !inv.customer?.email) return { ok: false, error: "La venta no tiene cliente para factura" };

    const cfg = tenant.ticketConfig ?? {};
    const businessName = cfg.businessName?.trim() || tenant.name;
    const label = receiptLabel(cfg.ticketPrefix ?? "", sale.ticketNumber);

    const doc = await buildSaleReceiptPdf({
      business: {
        name: businessName,
        taxId: cfg.taxId ?? "",
        regime: cfg.taxRegime ?? "",
        address: cfg.address ?? "",
        location: cfg.location ?? "",
        phone: cfg.phone ?? "",
        email: cfg.email ?? "",
      },
      customer: inv.customer,
      receiptLabel: label,
      date: sale.saleDate,
      items: sale.items,
      subtotal: sale.subtotal,
      serviceAmount: sale.serviceAmount,
      serviceRate: sale.serviceRate,
      ivaAmount: sale.ivaAmount,
      ivaRate: sale.ivaRate,
      deliveryFee: sale.deliveryFee,
      tipAmount: sale.tipAmount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      mixedPayment: sale.mixedPayment,
      orderType: sale.orderType,
      tableNumber: sale.tableNumber,
      cashUserName: sale.cashUserName,
    });
    const pdf = Buffer.from(doc.output("arraybuffer"));

    const replyTo = (cfg.email || tenant.email || "").trim() || undefined;
    const result = await sendMail({
      to: inv.customer.email,
      cc: inv.customer.ccEmails,
      subject: `Tu comprobante de ${businessName} N.º ${label}`,
      html: saleReceiptEmailHtml({
        businessName,
        customerName: inv.customer.name,
        receiptLabel: label,
        dateLabel: crDateTimeLabel(sale.saleDate),
        totalLabel: `₡${pdfAmount(sale.total)}`,
        businessContact: [cfg.phone, cfg.email].filter(Boolean).join(" · "),
      }),
      attachments: [{ filename: saleReceiptFilename(label), content: pdf, contentType: "application/pdf" }],
      replyTo,
      fromName: `${businessName} vía Ennea`,
    });

    await Sale.updateOne(
      { _id: saleId, tenantId },
      result.ok
        ? { $set: { "invoice.emailStatus": "enviado", "invoice.emailSentAt": new Date(), "invoice.emailError": "", "invoice.outdated": false }, $inc: { "invoice.sendCount": 1 } }
        : { $set: { "invoice.emailStatus": "fallido", "invoice.emailError": (result.error ?? "Error al enviar").slice(0, 300) } },
    );
    return result;
  } catch (err) {
    console.error("[saleInvoice] Error mandando el comprobante:", err);
    const message = err instanceof Error ? err.message : String(err);
    await Sale.updateOne(
      { _id: saleId, tenantId },
      { $set: { "invoice.emailStatus": "fallido", "invoice.emailError": message.slice(0, 300) } },
    ).catch(() => {});
    return { ok: false, error: message };
  }
}
