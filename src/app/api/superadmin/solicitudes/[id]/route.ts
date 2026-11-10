import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { TenantRequest } from "@/models/TenantRequest";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { ensureInvoice, getBillingSettings } from "@/server/services/billing";
import { crDay } from "@/lib/billing";
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
        planLimits:     true,
        status:         "active",
        theme: { primaryColor: "#6366F1", secondaryColor: "#8B5CF6", accentColor: "#F59E0B" },
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

    // Factura del primer mes, con el precio de la configuración de cobros. Como se crea a mitad de
    // mes, vence dentro de los días de aviso y no el día 1 que ya pasó.
    try {
      const { y, m } = crDay(new Date());
      await ensureInvoice(
        { _id: tenant._id, slug: tenant.slug, name: tenant.name, email: tenant.email, plan: tenant.plan, status: "active" },
        y, m, await getBillingSettings(),
      );
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
