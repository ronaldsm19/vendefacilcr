import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { TenantRequest } from "@/models/TenantRequest";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { Payment, PLAN_AMOUNTS } from "@/models/Payment";
import { getSuperadminSession } from "@/lib/auth";

function generateTempPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw + "1!";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const tenantReq = await TenantRequest.findById(id);
  if (!tenantReq) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  if (tenantReq.status !== "pending") return NextResponse.json({ error: "Solicitud ya procesada" }, { status: 409 });

  const { action, notes } = await request.json();

  if (action === "reject") {
    await TenantRequest.findByIdAndUpdate(id, {
      status: "rejected",
      notes,
      reviewedAt: new Date(),
      reviewedBy: session.email,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    const slugTaken = await Tenant.findOne({ slug: tenantReq.slug });
    if (slugTaken) return NextResponse.json({ error: "El slug ya está en uso" }, { status: 409 });

    let tenant;
    try {
      tenant = await Tenant.create({
        slug:           tenantReq.slug,
        name:           tenantReq.businessName,
        email:          tenantReq.email,
        whatsappNumber: tenantReq.whatsappNumber,
        plan:           tenantReq.plan,
        status:         "active",
        theme: { primaryColor: "#FF6B9D", secondaryColor: "#FF8C42", accentColor: "#FFD166" },
      });
    } catch (err) {
      console.error("Error creating tenant", err);
      return NextResponse.json({ error: "Error al crear el tenant" }, { status: 500 });
    }

    const tempPassword = generateTempPassword();
    try {
      const hash = await bcrypt.hash(tempPassword, 12);
      await User.create({ email: tenantReq.email, password: hash, role: "admin", tenantId: tenant._id });
    } catch (err) {
      await Tenant.findByIdAndDelete(tenant._id); // rollback
      console.error("Error creating user", err);
      return NextResponse.json({ error: "Error al crear el usuario admin" }, { status: 500 });
    }

    // Create first month payment
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 1);
    try {
      await Payment.create({
        tenantId:    tenant._id,
        tenantName:  tenant.name,
        tenantSlug:  tenant.slug,
        plan:        tenant.plan,
        periodYear:  now.getFullYear(),
        periodMonth: now.getMonth() + 1,
        amount:      PLAN_AMOUNTS[tenant.plan] ?? 12900,
        dueDate,
        status:      "pending",
      });
    } catch { /* non-critical */ }

    await TenantRequest.findByIdAndUpdate(id, {
      status:     "approved",
      tenantId:   tenant._id,
      notes,
      reviewedAt: new Date(),
      reviewedBy: session.email,
    });

    return NextResponse.json({ ok: true, tenant, tempPassword });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
