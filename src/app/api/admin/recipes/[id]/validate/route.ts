import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Recipe, IRecipeIngredient } from "@/models/Recipe";
import { RawMaterial } from "@/models/RawMaterial";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const recipe = await Recipe.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!recipe) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (!recipe.ingredients.length) {
    return NextResponse.json({ canMake: 0, missing: [], message: "La receta no tiene ingredientes" });
  }

  const materialIds = recipe.ingredients.map((i: IRecipeIngredient) => i.rawMaterialId);
  const materials = await RawMaterial.find({
    _id: { $in: materialIds },
    tenantId: session.tenantId,
  }).lean();

  const matMap = new Map(materials.map((m) => [String(m._id), m]));

  const batchesPerIngredient: number[] = [];
  const missing: Array<{ name: string; needed: number; have: number; unit: string }> = [];

  for (const ing of recipe.ingredients) {
    const mat = matMap.get(String(ing.rawMaterialId));
    const have = mat?.stock ?? 0;
    const needed = ing.quantity;

    if (needed <= 0) continue;

    const possible = Math.floor(have / needed);
    batchesPerIngredient.push(possible);

    if (possible < 1) {
      missing.push({
        name:   ing.rawMaterialName,
        needed: needed,
        have:   have,
        unit:   ing.unit,
      });
    }
  }

  const canMake = batchesPerIngredient.length ? Math.min(...batchesPerIngredient) : 0;

  return NextResponse.json({ canMake, missing });
}
