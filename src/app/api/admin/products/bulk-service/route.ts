import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession, requireFeature } from "@/lib/auth";

/**
 * A qué productos se les cobra el servicio (10 %), por categoría. Sirve para apagarlo de una vez en
 * todo lo de la tienda (quesos, artesanías) y dejarlo en lo que se sirve en mesa.
 * GET  → [{ category, total, exempt }]  (exempt = productos de esa categoría que NO lo cobran)
 * PATCH { category, charges } → marca todos los productos de la categoría.
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "configuracion");
  if (denied) return denied;

  await connectToDatabase();
  const rows = await Product.aggregate<{ _id: string; total: number; exempt: number }>([
    { $match: { tenantId: new mongoose.Types.ObjectId(session.tenantId) } },
    { $group: {
        _id: "$category",
        total: { $sum: 1 },
        exempt: { $sum: { $cond: [{ $eq: ["$noService", true] }, 1, 0] } },
    } },
    { $sort: { _id: 1 } },
  ]);
  return NextResponse.json({
    categories: rows.map((r) => ({ category: r._id ?? "", total: r.total, exempt: r.exempt })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "configuracion");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const { category, charges } = body as { category?: unknown; charges?: unknown };
  if (typeof category !== "string" || !category.trim()) {
    return NextResponse.json({ error: "Indicá la categoría" }, { status: 400 });
  }
  if (typeof charges !== "boolean") {
    return NextResponse.json({ error: "Indicá si la categoría cobra servicio o no" }, { status: 400 });
  }

  const result = await Product.updateMany(
    { tenantId: session.tenantId, category },
    { $set: { noService: !charges } }
  );
  return NextResponse.json({ ok: true, matched: result.matchedCount ?? 0, modified: result.modifiedCount ?? 0 });
}
