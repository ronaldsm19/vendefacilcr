import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { parseDateRange } from "@/server/services/workShifts";
import { getPayrollOverview } from "@/server/services/payroll";

// Resumen de la planilla del período: horas, lo que se debe y lo ya pagado, por persona.
// Solo el administrador: es el dinero del personal.

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { searchParams } = new URL(request.url);
  try {
    const range = parseDateRange(searchParams.get("from"), searchParams.get("to"));
    return NextResponse.json(await getPayrollOverview(session.tenantId, range));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
