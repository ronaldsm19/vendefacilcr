import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { parseDateRange } from "@/server/services/workShifts";
import { computeServiceReport } from "@/server/services/serviceReport";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "jornada");
  if (deniedPlan) return deniedPlan;
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  try {
    const range = parseDateRange(searchParams.get("from"), searchParams.get("to"));
    return NextResponse.json(await computeServiceReport(session.tenantId, range));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
