import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonTable } from "@/models/SalonTable";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const areaId = searchParams.get("areaId");

  const query: Record<string, unknown> = { tenantId: session.tenantId };
  if (areaId) query.areaId = areaId;

  const tables = await SalonTable.find(query).lean();
  return NextResponse.json({ tables });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { areaId, shape, seats, label, x, y } = await request.json();
  if (!areaId) return NextResponse.json({ error: "areaId requerido" }, { status: 400 });

  const count = await SalonTable.countDocuments({ tenantId: session.tenantId, areaId });
  const table = await SalonTable.create({
    tenantId: session.tenantId,
    areaId,
    shape:  shape  ?? "round",
    seats:  seats  ?? 4,
    label:  label  ?? String(count + 1),
    x:      x      ?? 50,
    y:      y      ?? 50,
    status: "libre",
  });
  return NextResponse.json({ table }, { status: 201 });
}
