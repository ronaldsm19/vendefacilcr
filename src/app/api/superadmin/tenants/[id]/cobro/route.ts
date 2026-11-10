import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { tenantBillingView, updateTenantBilling } from "@/server/services/billing";

/** El cobro de un negocio: precio de lista, descuento, periodo sin costo y lo que tiene sin pagar. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await tenantBillingView(id));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  try {
    return NextResponse.json(await updateTenantBilling(id, body as Record<string, unknown>));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
