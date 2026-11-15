import { NextRequest, NextResponse } from "next/server";
import { getSession, requireFeature } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { deleteCategory } from "@/server/services/categories";
import { setCategorySection } from "@/server/services/sections";

/** Cambia la sección del negocio a la que pertenece la categoría: `{ sectionId }` ("" = ninguna). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    await setCategorySection(session.tenantId, id, body.sectionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  await deleteCategory(session.tenantId, id);
  return NextResponse.json({ ok: true });
}
