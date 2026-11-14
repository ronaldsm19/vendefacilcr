import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { deleteProof, proofFileUrl } from "@/server/services/mensualidad";

type Params = { params: Promise<{ id: string; proofId: string }> };

/** Abre el comprobante: redirige a un enlace firmado que vence en minutos. */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;
  const { id, proofId } = await params;
  try {
    const res = NextResponse.redirect(await proofFileUrl(id, proofId, session.tenantId));
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (err) {
    return serviceErrorResponse(err);
  }
}

/** Quita un comprobante que todavía nadie revisó. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;
  const { id, proofId } = await params;
  try {
    return NextResponse.json(await deleteProof(session, id, proofId));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
