import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const products = await Product.find({ tenantId: session.tenantId }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  const { name, description, price, cost, toppings, image, images, category, menuSection, available, featured, delivery, deliveryNote, stock } = body;
  if (!name || !price || !category) {
    return NextResponse.json({ error: "Faltan campos requeridos (nombre, precio, categoría)" }, { status: 400 });
  }

  const product = await Product.create({
    tenantId: session.tenantId,
    name, description,
    price: Number(price),
    cost:  cost !== undefined ? Number(cost) : 0,
    toppings: toppings ?? [],
    image,
    images: images ?? [],
    category,
    menuSection: menuSection ?? "panaderia",
    available: available ?? true,
    featured: featured ?? false,
    delivery: delivery ?? false,
    deliveryNote: deliveryNote ?? "",
    stock: typeof stock === "number" ? stock : 0,
  });

  return NextResponse.json({ product }, { status: 201 });
}
