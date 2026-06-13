import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonWall } from "@/models/SalonWall";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const areaId = searchParams.get("areaId");

  const query: Record<string, unknown> = { tenantId: session.tenantId };
  if (areaId) query.areaId = areaId;

  const walls = await SalonWall.find(query).lean();
  return NextResponse.json({ walls });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { areaId, x, y, length, orientation, wallType } = await request.json();
  if (!areaId) return NextResponse.json({ error: "areaId requerido" }, { status: 400 });

  const wall = await SalonWall.create({
    tenantId: session.tenantId,
    areaId,
    x:           x           ?? 50,
    y:           y           ?? 50,
    length:      length      ?? 25,
    orientation: orientation ?? "horizontal",
    wallType:    wallType    ?? "wall",
  });

  return NextResponse.json({ wall }, { status: 201 });
}
