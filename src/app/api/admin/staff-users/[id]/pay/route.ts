import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { saveStaffPay } from "@/server/services/payroll";

// Tarifa y teléfono de una persona del personal. Vive bajo staff-users porque es parte de la
// ficha del empleado, aunque se edite desde Planilla.

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const saved = await saveStaffPay(session.tenantId, id, {
      pay: body.pay,
      phone: body.phone,
    });
    return NextResponse.json(saved);
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
