import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonTable } from "@/models/SalonTable";
import { getSession } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  const allowed = ["shape", "seats", "label", "x", "y", "status", "statusNote", "areaId"];
  const $set: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) $set[key] = body[key];
  }

  const table = await SalonTable.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set },
    { new: true }
  ).lean();
  if (!table) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ table });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const table = await SalonTable.findOne({ _id: id, tenantId: session.tenantId });
  if (!table) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (table.status !== "libre") {
    return NextResponse.json({ error: "No se puede eliminar una mesa ocupada o reservada" }, { status: 409 });
  }

  await SalonTable.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
