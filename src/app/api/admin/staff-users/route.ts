import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { StaffUser, USERNAME_RE, PIN_RE } from "@/models/StaffUser";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  await connectToDatabase();
  const users = await StaffUser.find({ tenantId: session.tenantId })
    .select("-pinHash")
    .sort({ name: 1 })
    .lean();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const username = String(body.username ?? "").trim().toLowerCase();
  const role = body.role;
  const pin = String(body.pin ?? "");

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "El nombre es requerido (máximo 60 caracteres)" }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "El usuario debe tener entre 3 y 20 caracteres: solo minúsculas, números, punto o guion bajo" },
      { status: 400 }
    );
  }
  if (role !== "cajero" && role !== "mesero") {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  if (!PIN_RE.test(pin)) {
    return NextResponse.json({ error: "El PIN debe tener exactamente 4 dígitos" }, { status: 400 });
  }

  await connectToDatabase();

  const exists = await StaffUser.exists({ tenantId: session.tenantId, username });
  if (exists) {
    return NextResponse.json({ error: "Ya existe un usuario con ese nombre de usuario" }, { status: 409 });
  }

  try {
    const pinHash = await bcrypt.hash(pin, 12);
    const created = await StaffUser.create({ tenantId: session.tenantId, name, username, role, active: true, pinHash });
    return NextResponse.json(
      {
        user: {
          _id: created._id,
          name: created.name,
          username: created.username,
          role: created.role,
          active: created.active,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Ya existe un usuario con ese nombre de usuario" }, { status: 409 });
    }
    throw err;
  }
}
