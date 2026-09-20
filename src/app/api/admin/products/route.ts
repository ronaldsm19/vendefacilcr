import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession, requireFeature } from "@/lib/auth";
import { effectiveStation, isStation } from "@/lib/station";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos");
  if (denied) return denied;

  await connectToDatabase();
  const raw = await Product.find({ tenantId: session.tenantId }).sort({ createdAt: -1 }).lean() as Array<Record<string, unknown>>;
  const products = raw.map((p) => ({
    ...p,
    station: effectiveStation(p as { station?: string; menuSection?: string }),
    stationAssigned: typeof p.station === "string",
  }));
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json();

  const { name, description, price, cost, toppings, image, images, category, menuSection, station, available, featured, delivery, deliveryNote, stock } = body;
  if (!name || !price || !category) {
    return NextResponse.json({ error: "Faltan campos requeridos (nombre, precio, categoría)" }, { status: 400 });
  }
  if (station !== undefined && !isStation(station)) {
    return NextResponse.json({ error: "Estación inválida" }, { status: 400 });
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
    station: isStation(station) ? station : "cocina",
    available: available ?? true,
    featured: featured ?? false,
    delivery: delivery ?? false,
    deliveryNote: deliveryNote ?? "",
    stock: typeof stock === "number" ? stock : 0,
  });

  return NextResponse.json({ product }, { status: 201 });
}
