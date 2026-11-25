import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { moveOpenComandas } from "@/server/services/comandaMove";

/**
 * Cambio de mesa: pasa las comandas abiertas de una mesa a otra mesa libre.
 * Body: { fromTableId, toTableId, comandaId? } — sin comandaId se pasan todas las abiertas.
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const body = await request.json().catch(() => ({}));
  const { fromTableId, toTableId, comandaId } = body as { fromTableId?: unknown; toTableId?: unknown; comandaId?: unknown };
  if (typeof fromTableId !== "string" || typeof toTableId !== "string") {
    return NextResponse.json({ error: "Faltan la mesa de origen y la de destino" }, { status: 400 });
  }
  if (comandaId !== undefined && typeof comandaId !== "string") {
    return NextResponse.json({ error: "Comanda inválida" }, { status: 400 });
  }

  try {
    const result = await moveOpenComandas({ tenantId: session.tenantId, fromTableId, toTableId, comandaId });
    return NextResponse.json(result);
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
