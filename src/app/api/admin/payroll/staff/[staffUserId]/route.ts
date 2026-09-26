import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { getStaffPayrollDetail } from "@/server/services/payroll";

// Detalle de una persona: sus turnos sin pagar y el historial de pagos.

export async function GET(request: NextRequest, { params }: { params: Promise<{ staffUserId: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { staffUserId } = await params;
  try {
    return NextResponse.json(await getStaffPayrollDetail(session.tenantId, staffUserId));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
