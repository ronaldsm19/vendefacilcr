import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { seedProducts } from "@/data/seed";

// GET /api/products?category=gelatina|apretado|especial
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const query = category ? { category, available: true } : { available: true };
    const products = await Product.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json(
      { products, count: products.length },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/products]", error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}

// POST /api/products
// Body: { action: 'seed' }  → poblar DB con datos de ejemplo
// Body: product fields      → crear un producto nuevo
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();

    // ── Seed action ──────────────────────────────────────────────
    if (body.action === "seed") {
      await Product.deleteMany({});
      const inserted = await Product.insertMany(seedProducts);

      return NextResponse.json({
        message: `✅ Se insertaron ${inserted.length} productos de ejemplo`,
        count: inserted.length,
      });
    }

    // ── Create single product ────────────────────────────────────
    const { name, description, price, toppings, image, category, available } = body;

    if (!name || !description || !price || !image || !category) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, description, price, image, category" },
        { status: 400 }
      );
    }

    const product = await Product.create({
      name,
      description,
      price: Number(price),
      toppings: toppings ?? [],
      image,
      category,
      available: available ?? true,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/products]", error);

    if (
      error instanceof Error &&
      error.name === "ValidationError"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
