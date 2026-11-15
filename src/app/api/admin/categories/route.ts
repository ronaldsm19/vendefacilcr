import { NextRequest, NextResponse } from "next/server";
import { getSession, requireFeature, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { listCategories, createCategory } from "@/server/services/categories";
import { listSections } from "@/server/services/sections";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // A diferencia de POST/DELETE (gestión de categorías, admin/cajero vía "productos:editar" o
  // "productos"), el GET también lo necesita el mesero: la pantalla donde toma la comanda usa
  // este mismo orden para sus categorías, igual que la caja. Es de solo lectura, sin dato
  // sensible — mismo criterio que ya usa /api/admin/comandas/catalog.
  const denied = requireRole(session, "admin", "cajero", "mesero");
  if (denied) return denied;

  // Las secciones viajan junto con las categorías: todas las pantallas que ordenan por categoría
  // (caja, mesero, configuración) también filtran por sección.
  const [categories, sections] = await Promise.all([
    listCategories(session.tenantId),
    listSections(session.tenantId),
  ]);
  return NextResponse.json({ categories, sections });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label : "";

  try {
    const { category, created } = await createCategory(session.tenantId, label);
    return NextResponse.json({ category }, { status: created ? 201 : 200 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
