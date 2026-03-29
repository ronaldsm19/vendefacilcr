import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
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
  const material = await RawMaterial.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!material) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ material });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const { stock } = await request.json();
  if (typeof stock !== "number" || stock < 0)
    return NextResponse.json({ error: "Stock inválido" }, { status: 400 });

  const material = await RawMaterial.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { stock },
    { new: true, runValidators: true }
  ).lean();
  if (!material) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ material });
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

  const material = await RawMaterial.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    body,
    { new: true, runValidators: true }
  ).lean();
  if (!material) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ material });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  await RawMaterial.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
