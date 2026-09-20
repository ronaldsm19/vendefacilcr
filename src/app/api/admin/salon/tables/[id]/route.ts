import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonTable } from "@/models/SalonTable";
import { getSession, requireFeature } from "@/lib/auth";
import { buildStatusUpdate, isTableStatus } from "@/lib/tableStatus";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "salon:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  if (body.status !== undefined && !isTableStatus(body.status)) {
    return NextResponse.json({ error: "Estado de mesa inválido" }, { status: 400 });
  }

  const allowed = ["shape", "seats", "label", "x", "y", "statusNote", "areaId"];
  const $set: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) $set[key] = body[key];
  }

  if (body.status !== undefined) {
    const current = await SalonTable.findOne({ _id: id, tenantId: session.tenantId }).lean();
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    Object.assign($set, buildStatusUpdate(current.status, body.status, {
      note: typeof body.statusNote === "string" ? body.statusNote : undefined,
      byName: session.name ?? "Administrador",
    }));
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
  const denied = requireFeature(session, "salon:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();

  const table = await SalonTable.findOne({ _id: id, tenantId: session.tenantId });
  if (!table) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (table.status !== "libre") {
    return NextResponse.json({ error: "No se puede eliminar una mesa que no está libre" }, { status: 409 });
  }

  await SalonTable.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
