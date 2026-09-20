import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("saleDeletePasswordHash").lean() as
    | { saleDeletePasswordHash?: string }
    | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json({ configured: !!tenant.saleDeletePasswordHash });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const { password } = body as { password?: unknown };

  if (password === null) {
    await Tenant.findByIdAndUpdate(session.tenantId, { $set: { saleDeletePasswordHash: "" } });
    return NextResponse.json({ configured: false });
  }

  if (typeof password !== "string" || password.length < 4) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  await Tenant.findByIdAndUpdate(session.tenantId, { $set: { saleDeletePasswordHash: hash } });
  return NextResponse.json({ configured: true });
}
