import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { TenantRequest } from "@/models/TenantRequest";
import { getSuperadminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";
  const page   = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit  = Math.min(50, Number(searchParams.get("limit") ?? 20));

  const query = status === "all" ? {} : { status };

  const [requests, total] = await Promise.all([
    TenantRequest.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TenantRequest.countDocuments(query),
  ]);

  return NextResponse.json({ requests, total, page, limit });
}

export async function POST(request: NextRequest) {
  // Public endpoint — anyone can submit a new request (no auth needed)
  try {
    await connectToDatabase();
    const body = await request.json();
    const { businessName, slug, ownerName, email, whatsappNumber, plan } = body;

    if (!businessName || !slug || !ownerName || !email || !whatsappNumber) {
      return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
    }

    const existing = await TenantRequest.findOne({ slug, status: { $in: ["pending", "approved"] } });
    if (existing) return NextResponse.json({ error: "Ese slug ya está solicitado o en uso" }, { status: 409 });

    const req = await TenantRequest.create({ businessName, slug, ownerName, email, whatsappNumber, plan: plan ?? "emprende" });
    return NextResponse.json({ ok: true, id: req._id }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/superadmin/solicitudes]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
