import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { getSuperadminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const status  = searchParams.get("status");
  const plan    = searchParams.get("plan");
  const search  = searchParams.get("search")?.trim();
  const page    = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit   = Math.min(50, Number(searchParams.get("limit") ?? 20));

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (plan)   query.plan   = plan;
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

  const existing = await Tenant.findOne({ slug });
  if (existing) return NextResponse.json({ error: "El slug ya está en uso" }, { status: 409 });

  const tenant = await Tenant.create({ slug, name, email, whatsappNumber, plan, status, theme, logoUrl, description });

  // Create admin user with temporary password
  const tempPassword = Math.random().toString(36).slice(2, 10) + "A1!";
  const hash = await bcrypt.hash(tempPassword, 12);
  await User.create({ email, password: hash, role: "admin", tenantId: tenant._id });

  return NextResponse.json({ tenant, tempPassword }, { status: 201 });
}
