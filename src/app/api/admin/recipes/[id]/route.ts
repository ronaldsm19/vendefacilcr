import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Recipe } from "@/models/Recipe";
import { RawMaterial } from "@/models/RawMaterial";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const recipe = await Recipe.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!recipe) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ recipe });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();
  const { name, description, yield: batchYield, sellingPrice, ingredients } = body;

  try {
    const update: Record<string, unknown> = {};
    if (name         !== undefined) update.name         = name;
    if (description  !== undefined) update.description  = description;
    if (batchYield   !== undefined) update.yield        = Number(batchYield);
    if (sellingPrice !== undefined) update.sellingPrice = Number(sellingPrice);

    if (Array.isArray(ingredients)) {
      update.ingredients = await Promise.all(
        ingredients.map(async (ing: { rawMaterialId: string; quantity: number }) => {
          const mat = await RawMaterial.findOne({
            _id: ing.rawMaterialId,
            tenantId: session.tenantId,
          }).lean();
          if (!mat) throw new Error(`Material ${ing.rawMaterialId} no encontrado`);
          return {
            rawMaterialId:   mat._id,
            rawMaterialName: mat.name,
            quantity:        Number(ing.quantity),
            unit:            mat.unit,
          };
        })
      );
    }

    const recipe = await Recipe.findOneAndUpdate(
      { _id: id, tenantId: session.tenantId },
      update,
      { new: true, runValidators: true }
    ).lean();

    if (!recipe) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ recipe });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar receta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  await Recipe.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
