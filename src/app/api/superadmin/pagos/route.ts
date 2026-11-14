import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Payment } from "@/models/Payment";
import { Tenant } from "@/models/Tenant";
import { getSuperadminSession } from "@/lib/auth";
import { ensureInvoice, generateMonth, getBillingSettings } from "@/server/services/billing";
import { REVIEW_QUEUE_FILTER, reviewQueueCount } from "@/server/services/mensualidad";
import { crDay } from "@/lib/billing";

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const year   = searchParams.get("year")  ? Number(searchParams.get("year"))  : undefined;
  const month  = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
  const page   = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit  = Math.min(100, Number(searchParams.get("limit") ?? 30));
  // review=submitted: la fila "Por revisar" (comprobantes esperando, de cualquier mes).
  const toReview = searchParams.get("review") === "submitted";
  const q = (searchParams.get("q") ?? "").trim().slice(0, 60);

  const query: Record<string, unknown> = toReview ? { ...REVIEW_QUEUE_FILTER } : {};
  if (!toReview) {
    if (status) query.status = status;
    if (year)   query.periodYear  = year;
    if (month)  query.periodMonth = month;
  }
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ tenantName: re }, { tenantSlug: re }];
  }

  const sort: Record<string, 1 | -1> = toReview
    ? { "review.submittedAt": 1 }
    : { periodYear: -1, periodMonth: -1, tenantSlug: 1 };
  const [payments, total, reviewCount] = await Promise.all([
    // La ruta del archivo no hace falta en la lista: el comprobante se abre desde la revisión.
    Payment.find(query).select("-proofs.path").sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(query),
    reviewQueueCount(),
  ]);

  return NextResponse.json({ payments, total, page, limit, reviewCount });
}

/**
 * Crea facturas a mano: las de un mes para todos los negocios activos ({ generateAll }) o la de un
 * negocio. El precio sale de la configuración de cobros y del descuento o la cortesía de cada uno.
 */
export async function POST(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const now = crDay(new Date());
  const year = Number(body.year ?? body.periodYear) || now.y;
  const month = Number(body.month ?? body.periodMonth) || now.m;
  if (month < 1 || month > 12) return NextResponse.json({ error: "Mes inválido" }, { status: 400 });

  if (body.generateAll) {
    const { created } = await generateMonth(year, month);
    return NextResponse.json({ created });
  }

  if (!body.tenantId || !mongoose.isValidObjectId(body.tenantId)) {
    return NextResponse.json({ error: "tenantId, periodYear, periodMonth requeridos" }, { status: 400 });
  }
  const tenant = await Tenant.findById(body.tenantId).select("_id slug name email plan status suspendedReason billing").lean();
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  await ensureInvoice(tenant as never, year, month, await getBillingSettings());
  const payment = await Payment.findOne({ tenantId: body.tenantId, periodYear: year, periodMonth: month }).lean();
  return NextResponse.json({ payment }, { status: 201 });
}
