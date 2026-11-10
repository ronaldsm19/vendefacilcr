import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { ownerBillingView } from "@/server/services/billing";

/** "Mi plan": la mensualidad del negocio. Solo el dueño; el personal no ve lo que paga el negocio. */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador" }, { status: 403 });
  try {
    return NextResponse.json(await ownerBillingView(session.tenantId));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
