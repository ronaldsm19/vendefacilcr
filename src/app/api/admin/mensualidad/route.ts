import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { ownerMonthlyView } from "@/server/services/mensualidad";

/** Mensualidad: lo que paga el negocio cada mes y sus comprobantes. Solo el dueño (rol administrador). */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;
  try {
    return NextResponse.json(await ownerMonthlyView(session));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
