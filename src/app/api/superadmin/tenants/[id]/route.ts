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
import { StaffUser } from "@/models/StaffUser";
import { CashClose } from "@/models/CashClose";
import { CashSession } from "@/models/CashSession";
import { SiteSettings } from "@/models/SiteSettings";
import { TenantRequest } from "@/models/TenantRequest";
import { Comanda } from "@/models/Comanda";
import { PrintJob } from "@/models/PrintJob";
import { ErrorEvent } from "@/models/ErrorEvent";
import { NoticeRead } from "@/models/NoticeRead";
import { SalonTable } from "@/models/SalonTable";
import { SalonWall } from "@/models/SalonWall";
import { SalonReservation } from "@/models/SalonReservation";
import { TableArea } from "@/models/TableArea";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { getSuperadminSession } from "@/lib/auth";
import { isSuspensionReason, SUSPENSION_MESSAGE_MAX } from "@/lib/suspension";
import { forgetTenantStatus } from "@/server/services/tenantAccess";

const STATUSES = ["active", "inactive", "suspended"];

/**
 * Lo que cambia junto con el estado. Al suspender (o desactivar) se guarda el motivo y el mensaje
 * para el dueño; al reactivar se limpian. Devuelve un error si los datos no sirven.
 */
function statusUpdate(
  body: Record<string, unknown>,
  current: { status: string },
): { set: Record<string, unknown> } | { error: string } {
  const status = body.status === undefined ? current.status : body.status;
  if (typeof status !== "string" || !STATUSES.includes(status)) return { error: "Estado inválido" };

  if (status === "active") {
    return { set: { status, suspendedReason: "", suspendedMessage: "", suspendedAt: null } };
  }

  const set: Record<string, unknown> = { status };
  if (current.status === "active") {
    set.suspendedAt = new Date();
    set.suspendedReason = "otro";
    set.suspendedMessage = "";
  }
  if (body.suspendedReason !== undefined) {
    if (!isSuspensionReason(body.suspendedReason)) return { error: "Motivo de suspensión inválido" };
    set.suspendedReason = body.suspendedReason;
  }
  if (body.suspendedMessage !== undefined) {
    if (typeof body.suspendedMessage !== "string") return { error: "Mensaje inválido" };
    const message = body.suspendedMessage.trim();
    if (message.length > SUSPENSION_MESSAGE_MAX) {
      return { error: `El mensaje puede tener hasta ${SUSPENSION_MESSAGE_MAX} caracteres` };
    }
    set.suspendedMessage = message;
  }
  return { set };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const [tenant, payments, accessLogs, productCount] = await Promise.all([
    Tenant.findById(id).lean(),
    Payment.find({ tenantId: id }).sort({ periodYear: -1, periodMonth: -1 }).limit(12).lean(),
    AccessLog.find({ tenantId: id }).sort({ createdAt: -1 }).limit(20).lean(),
    // Para avisar antes de pasarlo a un plan con tope de productos.
    Product.countDocuments({ tenantId: id }),
  ]);

  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ tenant, payments, accessLogs, productCount });
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

  const allowedFields = ["name", "email", "whatsappNumber", "plan", "theme", "logoUrl", "description"];
  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  if (body.planLimits !== undefined) {
    if (typeof body.planLimits !== "boolean") {
      return NextResponse.json({ error: "Límites del plan inválidos" }, { status: 400 });
    }
    update.planLimits = body.planLimits;
  }

  if (body.status !== undefined || body.suspendedReason !== undefined || body.suspendedMessage !== undefined) {
    const current = await Tenant.findById(id).select("status").lean() as { status: string } | null;
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const result = statusUpdate(body, current);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    Object.assign(update, result.set);
  }

  const tenant = await Tenant.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true }).lean();
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  // Las sesiones abiertas de este negocio se cortan (o vuelven), y ven su plan nuevo, en el próximo
  // pedido a esta instancia; en las demás, cuando venza su minuto de caché.
  forgetTenantStatus(id);
  return NextResponse.json({ tenant });
}

/**
 * Elimina un tenant y TODOS sus datos relacionados en cascada: usuarios,
 * productos, ventas, pedidos, gastos, categorías, recetas, materiales,
 * producciones, clicks, cajeros, sesiones y cierres de caja, configuración,
 * pagos, accesos, solicitudes, comandas, cola de impresión y todo el Salón
 * (mesas, paredes, zonas, reservas). También limpia las imágenes en
 * Supabase Storage.
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
    ["staffUsers",    StaffUser],
    ["cashCloses",    CashClose],
    ["cashSessions",  CashSession],
    ["siteSettings",  SiteSettings],
    ["payments",      Payment],
    ["accessLogs",    AccessLog],
    ["tenantRequests", TenantRequest],
    ["comandas",      Comanda],
    ["printJobs",     PrintJob],
    ["errorEvents",   ErrorEvent],
    ["noticeReads",   NoticeRead],
    ["salonTables",   SalonTable],
    ["salonWalls",    SalonWall],
    ["salonReservations", SalonReservation],
    ["tableAreas",    TableArea],
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
