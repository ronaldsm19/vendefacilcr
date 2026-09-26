import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { getPaymentWithShifts } from "@/server/services/payroll";

// Un pago con los turnos que cubrió: es lo que necesita el comprobante.

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  try {
    return NextResponse.json({ payment: await getPaymentWithShifts(session.tenantId, id) });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
