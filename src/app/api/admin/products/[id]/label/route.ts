import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession, requireFeature } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { MAX_LABEL_LINE, MAX_LABEL_LINES, normalizeLabel } from "@/lib/productLabel";

/** Guarda el formato de la etiqueta adhesiva de un producto (Productos → Etiqueta). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const label = normalizeLabel(body);
  if (!label) {
    return NextResponse.json(
      { error: `La etiqueta puede tener hasta ${MAX_LABEL_LINES} líneas de ${MAX_LABEL_LINE} caracteres` },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const res = await Product.updateOne({ _id: id, tenantId: session.tenantId }, { $set: { label } });
  if (res.matchedCount === 0) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json({ label });
}
