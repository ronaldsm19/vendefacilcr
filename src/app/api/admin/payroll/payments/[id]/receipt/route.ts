import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { attachReceiptPdf } from "@/server/services/payroll";

// Guarda la ruta del comprobante que la pantalla ya generó y subió al almacén privado, y
// devuelve un enlace firmado recién hecho para mandarlo.

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
    return NextResponse.json(await attachReceiptPdf(session.tenantId, id, String(body.path ?? "")));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
