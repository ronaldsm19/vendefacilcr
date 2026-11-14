import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { proofFileUrl } from "@/server/services/mensualidad";

/** Abre un comprobante: redirige a un enlace firmado que vence en minutos. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; proofId: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id, proofId } = await params;
  try {
    const res = NextResponse.redirect(await proofFileUrl(id, proofId));
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
