import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/models/Category";
import { getSession, requireRole } from "@/lib/auth";

/** Guarda el orden de TODAS las categorías del tenant de una vez, según la posición en `ids`. */
export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const { ids } = body as { ids?: unknown };

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids inválido" }, { status: 400 });
  }

  const existing = await Category.find({ tenantId: session.tenantId }).select("_id").lean();
  const existingIds = new Set(existing.map((c) => String(c._id)));
  const incomingIds = new Set(ids as string[]);

  const allBelongToTenant = (ids as string[]).every((id) => existingIds.has(id));
  const sameSize = incomingIds.size === ids.length && incomingIds.size === existingIds.size;
  if (!allBelongToTenant || !sameSize) {
    return NextResponse.json(
      { error: "La lista no coincide con las categorías de este negocio (falta alguna, sobra alguna, o hay repetidas)" },
      { status: 400 }
    );
  }

  await Category.bulkWrite(
    (ids as string[]).map((id, index) => ({
      updateOne: { filter: { _id: id, tenantId: session.tenantId }, update: { $set: { order: index } } },
    }))
  );

  return NextResponse.json({ ok: true });
}
