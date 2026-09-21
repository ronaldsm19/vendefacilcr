import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/models/Category";
import { getSession, requireFeature, requireRole } from "@/lib/auth";

const DEFAULTS = ["Gelatina Mosaico", "Apretado Gourmet", "Edición Especial"];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // A diferencia de POST/DELETE (gestión de categorías, admin/cajero vía "productos:editar" o
  // "productos"), el GET también lo necesita el mesero: la pantalla donde toma la comanda usa
  // este mismo orden para sus categorías, igual que la caja. Es de solo lectura, sin dato
  // sensible — mismo criterio que ya usa /api/admin/comandas/catalog.
  const denied = requireRole(session, "admin", "cajero", "mesero");
  if (denied) return denied;

  await connectToDatabase();
  let cats = await Category.find({ tenantId: session.tenantId }).sort({ order: 1, label: 1 }).lean();
  if (cats.length === 0) {
    await Category.insertMany(DEFAULTS.map((label) => ({ label, tenantId: session.tenantId })));
    cats = await Category.find({ tenantId: session.tenantId }).sort({ order: 1, label: 1 }).lean();
  }

  // Migración idempotente: mientras nadie haya tocado el orden (todas en 0, el default del
  // schema), les asigna un correlativo siguiendo el alfabético que ya tenían, para que nadie
  // note un cambio hasta que el admin arrastre algo. Una vez que se reordena de verdad, esto
  // deja de aplicar (ya no todas quedan en 0).
  if (cats.length > 0 && cats.every((c) => !c.order)) {
    const alphabetical = [...cats].sort((a, b) => a.label.localeCompare(b.label));
    await Category.bulkWrite(
      alphabetical.map((c, index) => ({
        updateOne: { filter: { _id: c._id, tenantId: session.tenantId }, update: { $set: { order: index } } },
      }))
    );
    cats = alphabetical.map((c, index) => ({ ...c, order: index }));
  }

  return NextResponse.json({ categories: JSON.parse(JSON.stringify(cats)) });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  await connectToDatabase();
  const { label } = await request.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label requerido" }, { status: 400 });
  }

  const existing = await Category.findOne({
    tenantId: session.tenantId,
    label: { $regex: `^${label.trim()}$`, $options: "i" },
  }).lean();
  if (existing) {
    return NextResponse.json({ category: JSON.parse(JSON.stringify(existing)) });
  }

  const last = await Category.findOne({ tenantId: session.tenantId }).sort({ order: -1 }).select("order").lean();
  const nextOrder = (last?.order ?? -1) + 1;
  const cat = await Category.create({ tenantId: session.tenantId, label: label.trim(), order: nextOrder });
  return NextResponse.json({ category: JSON.parse(JSON.stringify(cat)) }, { status: 201 });
}
