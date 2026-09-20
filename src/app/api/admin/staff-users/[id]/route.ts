import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { StaffUser, PIN_RE } from "@/models/StaffUser";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  const body = await request.json();
  const $set: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 60) {
      return NextResponse.json({ error: "El nombre es requerido (máximo 60 caracteres)" }, { status: 400 });
    }
    $set.name = name;
  }
  if (body.role !== undefined) {
    if (body.role !== "cajero" && body.role !== "mesero") {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }
    $set.role = body.role;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "Valor de activo inválido" }, { status: 400 });
    }
    $set.active = body.active;
  }
  if (body.pin !== undefined) {
    const pin = String(body.pin);
    if (!PIN_RE.test(pin)) {
      return NextResponse.json({ error: "El PIN debe tener exactamente 4 dígitos" }, { status: 400 });
    }
    $set.pinHash = await bcrypt.hash(pin, 12);
  }

  if (Object.keys($set).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await StaffUser.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set },
    { new: true, runValidators: true }
  ).select("-pinHash").lean();

  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  await connectToDatabase();
  await StaffUser.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
