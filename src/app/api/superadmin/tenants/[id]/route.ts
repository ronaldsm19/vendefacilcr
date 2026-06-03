import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { Payment } from "@/models/Payment";
import { AccessLog } from "@/models/AccessLog";
import { User } from "@/models/User";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";
import { Order } from "@/models/Order";
import { Expense } from "@/models/Expense";
import { Category } from "@/models/Category";
import { Recipe } from "@/models/Recipe";
import { RawMaterial } from "@/models/RawMaterial";
import { Production } from "@/models/Production";
import { ProductClick } from "@/models/ProductClick";
import { CashUser } from "@/models/CashUser";
import { CashClose } from "@/models/CashClose";
import { SiteSettings } from "@/models/SiteSettings";
import { TenantRequest } from "@/models/TenantRequest";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { getSuperadminSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const [tenant, payments, accessLogs] = await Promise.all([
    Tenant.findById(id).lean(),
    Payment.find({ tenantId: id }).sort({ periodYear: -1, periodMonth: -1 }).limit(12).lean(),
    AccessLog.find({ tenantId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ tenant, payments, accessLogs });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  const allowedFields = ["name", "email", "whatsappNumber", "plan", "status", "theme", "logoUrl", "description"];
  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  const tenant = await Tenant.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ tenant });
}

/**
 * Elimina un tenant y TODOS sus datos relacionados en cascada: usuarios,
 * productos, ventas, pedidos, gastos, categorías, recetas, materiales,
 * producciones, clicks, cajeros, cierres de caja, configuración, pagos,
 * accesos y solicitudes. También limpia las imágenes en Supabase Storage.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const tenant = await Tenant.findById(id).lean() as { _id: unknown; slug: string } | null;
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Matchear tenantId guardado como ObjectId o como string (datos legacy)
  const ids: (string | mongoose.Types.ObjectId)[] = [id];
  if (mongoose.Types.ObjectId.isValid(id)) ids.push(new mongoose.Types.ObjectId(id));
  const match = { tenantId: { $in: ids } };

  // Borrado en cascada de todas las colecciones relacionadas
  const collections: [string, { deleteMany: (q: object) => Promise<{ deletedCount?: number }> }][] = [
    ["users",         User],
    ["products",      Product],
    ["sales",         Sale],
    ["orders",        Order],
    ["expenses",      Expense],
    ["categories",    Category],
    ["recipes",       Recipe],
    ["rawMaterials",  RawMaterial],
    ["productions",   Production],
    ["productClicks", ProductClick],
    ["cashUsers",     CashUser],
    ["cashCloses",    CashClose],
    ["siteSettings",  SiteSettings],
    ["payments",      Payment],
    ["accessLogs",    AccessLog],
    ["tenantRequests", TenantRequest],
  ];

  const deleted: Record<string, number> = {};
  await Promise.all(
    collections.map(async ([key, model]) => {
      const res = await model.deleteMany(match);
      deleted[key] = res.deletedCount ?? 0;
    })
  );

  // Eliminar el tenant
  await Tenant.deleteOne({ _id: tenant._id });

  // Limpieza best-effort de imágenes en Supabase Storage (no bloquea el borrado)
  try {
    const folders = ["products", "billing", "about", "hero", "logo", "menu"];
    for (const folder of folders) {
      const prefix = `vendefacilcr/${tenant.slug}/${folder}`;
      const { data: files } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(prefix, { limit: 1000 });
      if (files && files.length) {
        const paths = files.map((f) => `${prefix}/${f.name}`);
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
      }
    }
  } catch (err) {
    console.error("[DELETE tenant] fallo limpiando storage:", err);
  }

  return NextResponse.json({ ok: true, slug: tenant.slug, deleted });
}
