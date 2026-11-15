import { NextRequest, NextResponse } from "next/server";
import { getSession, requireFeature, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { listSections, saveSections } from "@/server/services/sections";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // Solo lectura: la usan la caja y la pantalla del mesero para filtrar, igual que las categorías.
  const denied = requireRole(session, "admin", "cajero", "mesero");
  if (denied) return denied;

  return NextResponse.json({ sections: await listSections(session.tenantId) });
}

/** Reemplaza la lista completa: `{ sections: [{ id?, name }] }` en el orden en que se muestran. */
export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  try {
    const sections = await saveSections(session.tenantId, body.sections);
    return NextResponse.json({ sections });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
