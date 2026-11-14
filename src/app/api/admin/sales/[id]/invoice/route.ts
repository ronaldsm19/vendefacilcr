import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale, type ISale } from "@/models/Sale";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { summarizeInvoice } from "@/lib/saleReceipt";
import { consumeAttempt } from "@/server/services/rateLimit";
import {
  countInvoiceForCustomer, invoiceSnapshotFor, sendSaleInvoice, uncountInvoiceForCustomer,
} from "@/server/services/saleInvoice";

// Factura de una venta ya hecha. Lo más común es que el cliente la pida después de pagar:
//   { customerId }  → la venta queda a nombre de ese cliente y se le manda el comprobante.
//   { resend: true } → se vuelve a mandar al cliente que ya tiene (falló el correo, o se editó).
// Espera el envío para decirle a la caja si salió o no.

const MAX_SENDS_PER_MINUTE = 20;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "clientes") ?? requireFeature(session, "pedidos");
  if (denied) return denied;
  const deniedPlan = await requirePlan(session, "clientes");
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { customerId?: unknown; resend?: unknown };

  await connectToDatabase();
  const sale = await Sale.findOne({ _id: id, tenantId: session.tenantId })
    .select("customerId customerName saleDate invoice")
    .lean<Pick<ISale, "customerId" | "customerName" | "saleDate" | "invoice">>();
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

  if (!(await consumeAttempt(`invoice-send:${session.tenantId}`, MAX_SENDS_PER_MINUTE, 60_000))) {
    return NextResponse.json({ error: "Demasiados envíos seguidos. Esperá un minuto." }, { status: 429 });
  }

  if (body.resend === true) {
    if (!sale.invoice?.kind) {
      return NextResponse.json({ error: "Esta venta no tiene factura. Elegí primero el cliente." }, { status: 400 });
    }
  } else {
    const snapshot = await invoiceSnapshotFor(session.tenantId, String(body.customerId ?? ""));
    if (!snapshot) {
      return NextResponse.json({ error: "Ese cliente no está en el registro", code: "INVOICE_CUSTOMER_NOT_FOUND" }, { status: 400 });
    }
    const previous = sale.customerId;
    await Sale.updateOne(
      { _id: id, tenantId: session.tenantId },
      {
        $set: {
          customerId: snapshot.customerId,
          invoice: snapshot.invoice,
          // Una venta sin nombre (o con el del cliente anterior) pasa a llevar el del cliente.
          ...(!sale.customerName || sale.customerName === sale.invoice?.customer?.name
            ? { customerName: snapshot.customerName }
            : {}),
        },
      },
    );
    if (previous !== snapshot.customerId) {
      if (previous) await uncountInvoiceForCustomer(session.tenantId, previous);
      await countInvoiceForCustomer(session.tenantId, snapshot.customerId, sale.saleDate);
    }
  }

  const result = await sendSaleInvoice(session.tenantId, id);
  const updated = await Sale.findOne({ _id: id, tenantId: session.tenantId }).select("customerName invoice").lean<Pick<ISale, "customerName" | "invoice">>();
  return NextResponse.json(
    {
      ok: result.ok,
      ...(result.ok ? {} : { error: `No se pudo mandar el correo: ${result.error ?? "error desconocido"}` }),
      customerName: updated?.customerName ?? "",
      invoice: summarizeInvoice(updated?.invoice),
    },
    { status: result.ok ? 200 : 502 },
  );
}
