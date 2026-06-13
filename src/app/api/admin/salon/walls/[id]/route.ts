import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonWall } from "@/models/SalonWall";
import { getSession } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  const allowed = ["x", "y", "length", "orientation", "wallType"];
  const $set: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) $set[key] = body[key];
  }

  const wall = await SalonWall.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set },
    { new: true }
  ).lean();
  if (!wall) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ wall });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  await SalonWall.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
