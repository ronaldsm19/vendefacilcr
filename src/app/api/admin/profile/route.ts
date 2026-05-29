import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("name logoUrl").lean() as
    | { name?: string; logoUrl?: string }
    | null;

  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json({ name: tenant.name ?? "", logoUrl: tenant.logoUrl ?? "" });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.logoUrl === "string") update.logoUrl = body.logoUrl;

  await Tenant.findByIdAndUpdate(session.tenantId, { $set: update }, { runValidators: true });

  return NextResponse.json({ ok: true });
}
