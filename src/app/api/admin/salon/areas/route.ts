import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { TableArea } from "@/models/TableArea";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const areas = await TableArea.find({ tenantId: session.tenantId }).sort({ order: 1 }).lean();
  return NextResponse.json({ areas });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { name, color } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const count = await TableArea.countDocuments({ tenantId: session.tenantId });
  const area = await TableArea.create({
    tenantId: session.tenantId,
    name: name.trim(),
    color: color ?? "#6366f1",
    order: count,
  });
  return NextResponse.json({ area }, { status: 201 });
}
