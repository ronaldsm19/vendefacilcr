import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { approveProofs, rejectProofs } from "@/server/services/mensualidad";

/**
 * Revisión de los comprobantes de un mes: { action: "approve" } registra el pago (y al negocio le sale
 * "Pago verificado"); { action: "reject", reason } se lo devuelve con el motivo para que suba otro.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "approve") return NextResponse.json(await approveProofs(id, session.email));
    if (body.action === "reject") return NextResponse.json(await rejectProofs(id, body.reason, session.email));
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
