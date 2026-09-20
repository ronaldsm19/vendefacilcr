import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession, requireFeature } from "@/lib/auth";
import { isStation } from "@/lib/station";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const product = await Product.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  if (body.station !== undefined && !isStation(body.station)) {
    return NextResponse.json({ error: "Estación inválida" }, { status: 400 });
  }

  const product = await Product.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { ...body, price: body.price ? Number(body.price) : undefined },
    { new: true, runValidators: true }
  ).lean();

  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const { stock } = await request.json();
  if (typeof stock !== "number" || stock < 0)
    return NextResponse.json({ error: "Stock inválido" }, { status: 400 });
  const product = await Product.findOneAndUpdate({ _id: id, tenantId: session.tenantId }, { stock }, { new: true, runValidators: true }).lean();
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  await Product.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
