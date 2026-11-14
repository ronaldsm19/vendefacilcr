import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Payment } from "@/models/Payment";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { markCourtesy, markPaid } from "@/server/services/billing";
import { invoiceForReview, reopenProofs } from "@/server/services/mensualidad";

type Params = { params: Promise<{ id: string }> };

/** Una factura con sus comprobantes, para revisarla. */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await invoiceForReview(id));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}

/**
 * Cambia el estado de una factura. Marcarla pagada pasa por el servicio de cobros, que además
 * reactiva al negocio si estaba suspendido por falta de pago y aprueba los comprobantes que
 * esperaban revisión.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const { status, paidAt, notes, method, reference } = body;

  if (status === "paid") {
    try {
      return NextResponse.json(await markPaid(id, { method, reference, paidAt, notes }, session.email));
    } catch (err) {
      return serviceErrorResponse(err);
    }
  }

  if (status === "cortesia") {
    try {
      return NextResponse.json(await markCourtesy(id, body.reason));
    } catch (err) {
      return serviceErrorResponse(err);
    }
  }

  if (status !== undefined && !["pending", "late", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if (status) {
    update.status = status;
    // Volver a pendiente deshace el pago registrado.
    if (status === "pending") Object.assign(update, { paidAt: null, method: "", reference: "" });
  }
  if (notes !== undefined) update.notes = notes;

  const payment = await Payment.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true }).lean();
  if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  // Un mes que vuelve a cobrarse no puede quedar con sus comprobantes marcados como aprobados.
  if (status === "pending" || status === "late") await reopenProofs(id);
  return NextResponse.json({ payment, reactivated: false });
}
