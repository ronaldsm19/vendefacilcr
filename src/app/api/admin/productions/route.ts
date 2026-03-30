import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Production } from "@/models/Production";
import { Recipe } from "@/models/Recipe";
import { RawMaterial } from "@/models/RawMaterial";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const productions = await Production.find({ tenantId: session.tenantId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return NextResponse.json({ productions });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { recipeId, batches, notes } = await request.json();

  if (!recipeId || !batches || batches < 1) {
    return NextResponse.json({ error: "recipeId y batches son requeridos" }, { status: 400 });
  }

  const recipe = await Recipe.findOne({ _id: recipeId, tenantId: session.tenantId }).lean();
  if (!recipe) return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });

  if (!recipe.ingredients.length) {
    return NextResponse.json({ error: "La receta no tiene ingredientes" }, { status: 400 });
  }

  // Verify and deduct stock for each ingredient
  const ingredientsUsed = [];
  for (const ing of recipe.ingredients) {
    const mat = await RawMaterial.findOne({
      _id: ing.rawMaterialId,
      tenantId: session.tenantId,
    });
    if (!mat) {
      return NextResponse.json(
        { error: `Material "${ing.rawMaterialName}" no encontrado` },
        { status: 400 }
      );
    }

    const totalNeeded = ing.quantity * batches;
    if (mat.stock < totalNeeded) {
      return NextResponse.json(
        {
          error: `Stock insuficiente para "${ing.rawMaterialName}": necesitás ${totalNeeded} ${ing.unit}, tenés ${mat.stock}`,
        },
        { status: 400 }
      );
    }

    await RawMaterial.updateOne(
      { _id: mat._id },
      { $inc: { stock: -totalNeeded } }
    );

    ingredientsUsed.push({
      rawMaterialId:   ing.rawMaterialId,
      rawMaterialName: ing.rawMaterialName,
      quantity:        totalNeeded,
      unit:            ing.unit,
    });
  }

  const production = await Production.create({
    tenantId:      session.tenantId,
    recipeId:      recipe._id,
    recipeName:    recipe.name,
    batches,
    unitsProduced: batches * (recipe.yield ?? 1),
    notes:         notes || undefined,
    ingredientsUsed,
  });

  return NextResponse.json({ production }, { status: 201 });
}
