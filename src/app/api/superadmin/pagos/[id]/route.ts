import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Payment } from "@/models/Payment";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { markPaid } from "@/server/services/billing";

/**
 * Cambia el estado de una factura. Marcarla pagada pasa por el servicio de cobros, que además
 * reactiva al negocio si estaba suspendido por falta de pago.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const { status, paidAt, notes, method, reference } = body;

  if (status === "paid") {
    try {
      return NextResponse.json(await markPaid(id, { method, reference, paidAt, notes }));
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
  return NextResponse.json({ payment, reactivated: false });
}
