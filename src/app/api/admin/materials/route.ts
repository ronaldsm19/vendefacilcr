import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { RawMaterial } from "@/models/RawMaterial";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const materials = await RawMaterial.find({ tenantId: session.tenantId })
    .sort({ type: 1, name: 1 })
    .lean();
  return NextResponse.json({ materials });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const { name, type, unit, stock, minStock, costPerUnit, notes } = body;

  if (!name || !unit) {
    return NextResponse.json({ error: "Nombre y unidad son requeridos" }, { status: 400 });
  }

  const material = await RawMaterial.create({
    tenantId:    session.tenantId,
    name,
    type:        type ?? "ingrediente",
    unit,
    stock:       typeof stock       === "number" ? stock       : 0,
    minStock:    typeof minStock    === "number" ? minStock    : 0,
    costPerUnit: typeof costPerUnit === "number" ? costPerUnit : undefined,
    notes:       notes ?? undefined,
  });

  return NextResponse.json({ material }, { status: 201 });
}
