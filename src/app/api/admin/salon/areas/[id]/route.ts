import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { TableArea } from "@/models/TableArea";
import { SalonTable } from "@/models/SalonTable";
import { getSession } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const { name, color } = await request.json();

  const area = await TableArea.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set: { ...(name ? { name } : {}), ...(color ? { color } : {}) } },
    { new: true }
  ).lean();
  if (!area) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ area });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  // Check no occupied tables in this area
  const busy = await SalonTable.findOne({ areaId: id, status: { $in: ["ocupada", "reservada"] } });
  if (busy) return NextResponse.json({ error: "Hay mesas ocupadas o reservadas en esta zona" }, { status: 409 });

  await SalonTable.deleteMany({ areaId: id, tenantId: session.tenantId });
  await TableArea.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
