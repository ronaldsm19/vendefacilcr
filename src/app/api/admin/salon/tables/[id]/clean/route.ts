import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonTable } from "@/models/SalonTable";
import { getSession } from "@/lib/auth";
import { buildStatusUpdate } from "@/lib/tableStatus";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const table = await SalonTable.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!table) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (table.status !== "por_limpiar") {
    return NextResponse.json({ error: "La mesa no está por limpiar" }, { status: 409 });
  }

  const updated = await SalonTable.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId, status: "por_limpiar" },
    { $set: buildStatusUpdate("por_limpiar", "libre", { byName: session.name ?? "Administrador" }) },
    { new: true }
  ).lean();
  if (!updated) return NextResponse.json({ error: "La mesa no está por limpiar" }, { status: 409 });

  return NextResponse.json({ table: updated });
}
