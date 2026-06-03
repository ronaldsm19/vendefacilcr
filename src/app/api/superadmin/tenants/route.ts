import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { getSuperadminSession } from "@/lib/auth";
import { sendMail, welcomeEmailHtml } from "@/lib/email";

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const status  = searchParams.get("status");
  const plan    = searchParams.get("plan");
  const search  = searchParams.get("search")?.trim();
  const pwChanged = searchParams.get("passwordChanged"); // "true" | "false"
  const page    = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit   = Math.min(50, Number(searchParams.get("limit") ?? 20));

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (plan)   query.plan   = plan;
  if (pwChanged === "true")  query.passwordChanged = true;
  if (pwChanged === "false") query.passwordChanged = { $ne: true };
  if (search) query.$or = [
    { name:  { $regex: search, $options: "i" } },
    { slug:  { $regex: search, $options: "i" } },
    { email: { $regex: search, $options: "i" } },
  ];

  const [tenants, total] = await Promise.all([
    Tenant.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Tenant.countDocuments(query),
  ]);

  return NextResponse.json({ tenants, total, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const { slug, name, email, whatsappNumber, plan, status, theme, logoUrl, description } = body;

  if (!slug || !name || !email || !whatsappNumber) {
    return NextResponse.json({ error: "slug, name, email y whatsappNumber son requeridos" }, { status: 400 });
  }

  const emailNorm = String(email).toLowerCase().trim();

  // Validar duplicados ANTES de crear nada (slug del tenant + email del usuario)
  const existing = await Tenant.findOne({ slug });
  if (existing) return NextResponse.json({ error: "El slug ya está en uso" }, { status: 409 });

  const existingUser = await User.findOne({ email: emailNorm });
  if (existingUser) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese correo electrónico" },
      { status: 409 }
    );
  }

  const tenant = await Tenant.create({ slug, name, email: emailNorm, whatsappNumber, plan, status, theme, logoUrl, description });

  // Crear el usuario admin con contraseña temporal. Si falla, hacemos rollback del tenant.
  const tempPassword = Math.random().toString(36).slice(2, 10) + "A1!";
  try {
    const hash = await bcrypt.hash(tempPassword, 12);
    await User.create({ email: emailNorm, password: hash, role: "admin", tenantId: tenant._id });
  } catch (err) {
    await Tenant.deleteOne({ _id: tenant._id }); // evitar tenant huérfano
    console.error("[POST /api/superadmin/tenants] fallo creando usuario admin:", err);
    return NextResponse.json(
      { error: "No se pudo crear el usuario admin (¿correo duplicado?). El tenant no fue creado." },
      { status: 409 }
    );
  }

  // Correo de bienvenida — no bloquea la creación si falla (sendMail nunca lanza)
  await sendMail({
    to: emailNorm,
    subject: "¡Bienvenido a VendeFácil! Tus accesos",
    html: welcomeEmailHtml({ name, slug, email: emailNorm, tempPassword }),
  });

  return NextResponse.json({ tenant, tempPassword }, { status: 201 });
}
