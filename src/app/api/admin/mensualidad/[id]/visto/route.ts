import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { markReviewSeen } from "@/server/services/mensualidad";

/** El dueño cerró el aviso con el resultado de la revisión de un comprobante. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json(await markReviewSeen(session, id));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
