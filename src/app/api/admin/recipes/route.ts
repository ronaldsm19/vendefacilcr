import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Recipe } from "@/models/Recipe";
import { RawMaterial } from "@/models/RawMaterial";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const recipes = await Recipe.find({ tenantId: session.tenantId })
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json({ recipes });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const { name, description, yield: batchYield, sellingPrice, ingredients } = body;

  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  try {
    const hydratedIngredients = await Promise.all(
      (ingredients ?? []).map(async (ing: { rawMaterialId: string; quantity: number }) => {
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

    const recipe = await Recipe.create({
      tenantId:     session.tenantId,
      name,
      description:  description  ?? undefined,
      yield:        Number(batchYield ?? 1),
      sellingPrice: Number(sellingPrice ?? 0),
      ingredients:  hydratedIngredients,
    });

    return NextResponse.json({ recipe }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear receta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
