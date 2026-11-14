import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { Payment } from "@/models/Payment";
import { BILLING_DUE_DAY } from "@/models/BillingSettings";
import { ServiceError } from "@/server/errors";
import { sendMail, billingEmailHtml, proofSubmittedEmailHtml, getBaseUrl, escapeHtml } from "@/lib/email";
import { PRIVATE_BUCKET, ensurePrivateBucket, signPrivateUrl, supabaseAdmin } from "@/lib/supabase";
import { ENNEA_WHATSAPP } from "@/lib/contacto";
import { consumeAttempt } from "@/server/services/rateLimit";
import { getAlertSettings } from "@/server/services/errorAlerts";
import { ensureInvoice, getBillingSettings, markPaid } from "@/server/services/billing";
import {
  PLAN_LABELS, billingOf, priceFor, resolveBilling, crDay, crMidnight, nextPeriod, periodDueDate,
  periodLabel, formatCrDate, formatCRC, daysBetween, startOfCrDay, addDays,
  type PlanKey, type TenantBilling,
} from "@/lib/billing";
import {
  PROOF_LIMITS, PROOF_METHODS, PROOF_TYPES, OWNER_STATUS_LABELS, canDeleteProof, canReview, ownerStatusOf,
  proofMethodLabel, proofPath, reviewStatusOf, shownToOwner, shownToOwnerFilter, sniffProofType, uploadBlockedReason,
  type ProofStatus, type ReviewStatus,
} from "@/lib/mensualidad";

/**
 * Mensualidad: el dueño ve cuánto paga cada mes y sube el comprobante; el superadmin lo revisa y lo
 * aprueba (registra el pago) o lo rechaza con un motivo. Las reglas puras están en
 * src/lib/mensualidad.ts.
 *
 * Los archivos van al almacén privado (llevan datos bancarios): la base guarda la ruta y cada vez
 * que alguien quiere verlo se firma un enlace que vence en minutos.
 */

interface TenantLean {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  suspendedReason?: string;
  billing?: Partial<TenantBilling> & { freeEndNoticeAt?: Date | null };
}

interface ProofLean {
  _id: mongoose.Types.ObjectId;
  path: string;
  contentType: string;
  paidOn: Date;
  method: string;
  reference: string;
  note: string;
  uploadedAt: Date;
  uploadedBy: string;
  status: ProofStatus;
  rejectReason: string;
}

interface InvoiceLean {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  tenantName: string;
  tenantSlug: string;
  plan: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  listAmount?: number;
  discountAmount?: number;
  discountLabel?: string;
  status: string;
  dueDate: Date;
  paidAt?: Date | null;
  method?: string;
  reference?: string;
  proofs?: ProofLean[];
  review?: {
    status?: ReviewStatus;
    submittedAt?: Date | null;
    reviewedAt?: Date | null;
    reviewedBy?: string;
    reason?: string;
    ownerSeenAt?: Date | null;
  };
}

/** Lo que hace falta de la sesión del dueño. */
export interface OwnerSession { tenantId: string; tenantSlug: string; name: string; email?: string }

const TENANT_FIELDS = "_id slug name email plan status suspendedReason billing";
const OPEN = ["pending", "late"];
/** Lo que dura el enlace para ver un comprobante: alcanza para abrirlo, no para reenviarlo. */
const VIEW_URL_SECONDS = 5 * 60;
/** Días que se muestra el aviso con el resultado de la revisión si el dueño no lo cierra. */
const REVIEW_NOTICE_DAYS = 30;
const UPLOADS_PER_HOUR = 20;

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function validId(id: string, what = "Mes"): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw new ServiceError(404, `${what} no encontrado`);
  return new mongoose.Types.ObjectId(id);
}

function text(value: unknown, max: number, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ServiceError(400, `${label}: texto inválido`);
  const t = value.trim();
  if (t.length > max) throw new ServiceError(400, `${label}: hasta ${max} caracteres`);
  return t;
}

const crDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** AAAA-MM-DD de un día en Costa Rica, para los campos de fecha. */
function inputDay(d: Date): string {
  const { y, m, d: day } = crDay(d);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** La fecha del pago que escribió el dueño: no puede ser futura ni de hace más de 120 días. */
function parsePaidOn(value: unknown, now: Date): Date {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) throw new ServiceError(400, "Fecha del pago inválida");
  const date = crMidnight(Number(match[1]), Number(match[2]), Number(match[3]));
  const today = startOfCrDay(now);
  if (Number.isNaN(date.getTime()) || inputDay(date) !== value) throw new ServiceError(400, "Fecha del pago inválida");
  if (date.getTime() > today.getTime()) throw new ServiceError(400, "La fecha del pago no puede ser de un día que no ha llegado");
  if (daysBetween(date, today) > PROOF_LIMITS.paidOnMaxDaysAgo) throw new ServiceError(400, "La fecha del pago es muy vieja");
  return date;
}

async function removeFile(path: string) {
  try {
    await supabaseAdmin.storage.from(PRIVATE_BUCKET).remove([path]);
  } catch (err) {
    console.error("[mensualidad] No se pudo borrar el archivo", path, err);
  }
}

// ── El dueño ────────────────────────────────────────────────────────────────

/**
 * Crea la factura del mes (y la del siguiente si ya está cerca) para que el dueño pueda pagarla
 * aunque el cobro automático esté apagado. Es la misma factura que crearía el cobro automático.
 */
async function ensureOwnerInvoices(tenant: TenantLean, now: Date) {
  if (tenant.status !== "active") return;
  const settings = await getBillingSettings();
  const { y, m } = crDay(now);
  const next = nextPeriod(y, m);
  const periods = [{ y, m }];
  if (daysBetween(startOfCrDay(now), periodDueDate(next.y, next.m, BILLING_DUE_DAY)) <= settings.reminderDays) periods.push(next);
  for (const p of periods) {
    if (shownToOwner(p.y, p.m)) await ensureInvoice(tenant as never, p.y, p.m, settings, now);
  }
}

function ownerMonth(inv: InvoiceLean) {
  const id = String(inv._id);
  const status = ownerStatusOf(inv);
  return {
    id,
    period: periodLabel(inv.periodYear, inv.periodMonth),
    plan: PLAN_LABELS[inv.plan as PlanKey] ?? inv.plan,
    amount: inv.amount,
    listAmount: inv.listAmount ?? inv.amount,
    discountAmount: inv.discountAmount ?? 0,
    discountLabel: inv.discountLabel ?? "",
    status,
    statusLabel: OWNER_STATUS_LABELS[status],
    dueDate: formatCrDate(inv.dueDate),
    paidAt: inv.status === "paid" && inv.paidAt ? formatCrDate(inv.paidAt) : null,
    rejectReason: inv.review?.status === "rejected" ? inv.review.reason ?? "" : "",
    uploadBlocked: uploadBlockedReason(inv),
    proofs: [...(inv.proofs ?? [])]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map((p) => ({
        id: String(p._id),
        url: `/api/admin/mensualidad/${id}/comprobantes/${String(p._id)}`,
        isPdf: p.contentType === "application/pdf",
        paidOn: formatCrDate(p.paidOn),
        method: proofMethodLabel(p.method),
        reference: p.reference,
        note: p.note,
        uploadedAt: crDateTime(p.uploadedAt),
        status: p.status,
        rejectReason: p.rejectReason,
        canDelete: canDeleteProof(inv, p),
      })),
  };
}

export type OwnerMonth = ReturnType<typeof ownerMonth>;

/** El primer mes desde ahora en que la mensualidad cambia (fin de una cortesía o de un descuento). */
function upcomingChange(tenant: TenantLean, prices: Record<PlanKey, number>, y: number, m: number, current: number) {
  let p = { y, m };
  for (let i = 0; i < 12; i++) {
    p = nextPeriod(p.y, p.m);
    const price = priceFor(tenant.plan, billingOf(tenant), prices, periodDueDate(p.y, p.m, BILLING_DUE_DAY));
    if (price.amount !== current) {
      return { from: periodLabel(p.y, p.m), amount: price.amount, label: price.free ? "Sin costo" : price.discountLabel };
    }
  }
  return null;
}

/** Todo lo que muestra la pantalla Mensualidad. */
export async function ownerMonthlyView(session: OwnerSession, now = new Date()) {
  const tenantId = validId(session.tenantId, "Negocio");
  await connectToDatabase();
  const tenant = await Tenant.findById(tenantId).select(TENANT_FIELDS).lean() as TenantLean | null;
  if (!tenant) throw new ServiceError(404, "Negocio no encontrado");
  await ensureOwnerInvoices(tenant, now);

  const [settings, invoices] = await Promise.all([
    getBillingSettings(),
    Payment.find({ tenantId, ...shownToOwnerFilter() }).sort({ periodYear: -1, periodMonth: -1 }).lean() as unknown as Promise<InvoiceLean[]>,
  ]);

  const { y, m } = crDay(now);
  const due = periodDueDate(y, m, BILLING_DUE_DAY);
  const resolved = resolveBilling(tenant.plan, billingOf(tenant), due);
  const price = priceFor(tenant.plan, billingOf(tenant), settings.prices, due);

  // El mes que toca atender: el más viejo sin pagar; si está todo pagado, el de este mes.
  const open = invoices.filter((i) => OPEN.includes(i.status));
  const focus = open[open.length - 1]
    ?? invoices.find((i) => i.periodYear === y && i.periodMonth === m)
    ?? invoices[0]
    ?? null;

  const pay = settings.payment;
  return {
    planLabel: PLAN_LABELS[tenant.plan as PlanKey] ?? tenant.plan,
    price,
    discountUntil: !price.free && price.discountAmount > 0 && resolved.discountUntil ? formatCrDate(resolved.discountUntil) : null,
    freeUntil: price.free && resolved.freeUntil ? formatCrDate(resolved.freeUntil) : null,
    upcoming: upcomingChange(tenant, settings.prices, y, m, price.amount),
    focusId: focus ? String(focus._id) : null,
    months: invoices.map(ownerMonth),
    payment: {
      sinpeNumber: pay.sinpeNumber,
      sinpeName: pay.sinpeName,
      iban: pay.iban,
      ibanName: pay.ibanName,
      notes: pay.notes,
      whatsapp: (pay.whatsapp || ENNEA_WHATSAPP).replace(/\D/g, ""),
    },
    today: inputDay(now),
  };
}

/** Sube un comprobante a un mes y lo deja esperando revisión. */
export async function submitProof(session: OwnerSession, paymentId: string, form: FormData, now = new Date()) {
  const id = validId(paymentId);
  const tenantId = validId(session.tenantId, "Negocio");
  await connectToDatabase();

  const invoice = await Payment.findOne({ _id: id, tenantId }).lean() as InvoiceLean | null;
  if (!invoice || !shownToOwner(invoice.periodYear, invoice.periodMonth)) throw new ServiceError(404, "Mes no encontrado");
  const blocked = uploadBlockedReason(invoice);
  if (blocked) throw new ServiceError(409, blocked);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ServiceError(400, "Falta el comprobante");
  if (file.size > PROOF_LIMITS.maxBytes) throw new ServiceError(400, "El archivo no puede pasar de 4 MB");
  const paidOn = parsePaidOn(form.get("paidOn"), now);
  const method = String(form.get("method") ?? "");
  if (!PROOF_METHODS.some((p) => p.value === method)) throw new ServiceError(400, "Elegí cómo pagaste");
  const reference = text(form.get("reference"), PROOF_LIMITS.reference, "Referencia");
  const note = text(form.get("note"), PROOF_LIMITS.note, "Nota");

  // El tipo sale de los bytes, no del nombre ni de lo que diga el navegador.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffProofType(bytes);
  if (!contentType) throw new ServiceError(400, "Solo se aceptan imágenes (JPG, PNG o WEBP) o PDF");

  if (!await consumeAttempt(`mensualidad:${session.tenantId}`, UPLOADS_PER_HOUR, 60 * 60 * 1000)) {
    throw new ServiceError(429, "Se subieron muchos comprobantes seguidos. Probá de nuevo en un rato.");
  }

  await ensurePrivateBucket();
  const random = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = proofPath(invoice.tenantSlug, invoice.periodYear, invoice.periodMonth, random, PROOF_TYPES[contentType]);
  const { error } = await supabaseAdmin.storage.from(PRIVATE_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) {
    console.error("[mensualidad] Supabase:", error);
    throw new ServiceError(500, "No se pudo guardar el archivo. Probá de nuevo.");
  }

  const uploadedBy = session.email ? `${session.name} (${session.email})` : session.name;
  const proof = {
    _id: new mongoose.Types.ObjectId(), path, contentType, paidOn, method, reference, note,
    uploadedAt: now, uploadedBy, status: "submitted" as const, rejectReason: "",
  };
  // Condicionado: si mientras tanto se pagó, se anuló o se llenó el tope, no se agrega.
  const r = await Payment.updateOne(
    { _id: id, tenantId, status: { $in: OPEN }, [`proofs.${PROOF_LIMITS.perInvoice - 1}`]: { $exists: false } },
    { $push: { proofs: proof }, $set: { "review.status": "submitted", "review.submittedAt": now, "review.ownerSeenAt": null } },
  );
  if (r.modifiedCount !== 1) {
    await removeFile(path);
    throw new ServiceError(409, "Este mes cambió mientras subías el comprobante. Recargá la página.");
  }

  await notifySuperadmin(invoice, proof).catch((err) => console.error("[mensualidad] Aviso al superadmin:", err));
  return { ok: true };
}

/** Quita un comprobante que todavía nadie revisó (se equivocó de archivo, por ejemplo). */
export async function deleteProof(session: OwnerSession, paymentId: string, proofId: string) {
  const id = validId(paymentId);
  const pid = validId(proofId, "Comprobante");
  const tenantId = validId(session.tenantId, "Negocio");
  await connectToDatabase();

  const invoice = await Payment.findOne({ _id: id, tenantId }).lean() as InvoiceLean | null;
  const proof = invoice?.proofs?.find((p) => p._id.equals(pid));
  if (!invoice || !proof) throw new ServiceError(404, "Comprobante no encontrado");
  if (!canDeleteProof(invoice, proof)) throw new ServiceError(409, "Este comprobante ya se revisó y no se puede quitar");

  const remaining = (invoice.proofs ?? []).filter((p) => !p._id.equals(pid));
  const r = await Payment.updateOne(
    { _id: id, tenantId, status: { $in: OPEN }, proofs: { $elemMatch: { _id: pid, status: "submitted" } } },
    { $pull: { proofs: { _id: pid } }, $set: { "review.status": reviewStatusOf(remaining) } },
  );
  if (r.modifiedCount !== 1) throw new ServiceError(409, "Este comprobante ya se revisó y no se puede quitar");
  await removeFile(proof.path);
  return { ok: true };
}

/** El dueño cerró el aviso con el resultado de la revisión. */
export async function markReviewSeen(session: OwnerSession, paymentId: string, now = new Date()) {
  const id = validId(paymentId);
  await connectToDatabase();
  await Payment.updateOne(
    { _id: id, tenantId: validId(session.tenantId, "Negocio"), "review.ownerSeenAt": null },
    { $set: { "review.ownerSeenAt": now } },
  );
  return { ok: true };
}

/** El resultado de la última revisión que el dueño todavía no vio, para avisarle dentro del panel. */
export async function reviewNoticeFor(tenantId: string, now = new Date()) {
  if (!mongoose.isValidObjectId(tenantId)) return null;
  await connectToDatabase();
  const inv = await Payment.findOne({
    tenantId,
    "review.status": { $in: ["approved", "rejected"] },
    "review.ownerSeenAt": null,
    "review.reviewedAt": { $gte: addDays(now, -REVIEW_NOTICE_DAYS) },
  }).sort({ "review.reviewedAt": -1 }).lean() as InvoiceLean | null;
  if (!inv) return null;
  return {
    id: String(inv._id),
    period: periodLabel(inv.periodYear, inv.periodMonth),
    amount: inv.amount,
    status: inv.review?.status === "approved" ? "approved" as const : "rejected" as const,
    reason: inv.review?.reason ?? "",
  };
}

/**
 * Enlace firmado y corto para ver un comprobante. Con `tenantId` (el dueño) solo encuentra los de su
 * negocio; sin él (el superadmin), cualquiera.
 */
export async function proofFileUrl(paymentId: string, proofId: string, tenantId?: string): Promise<string> {
  const id = validId(paymentId);
  const pid = validId(proofId, "Comprobante");
  await connectToDatabase();
  const invoice = await Payment.findOne({ _id: id, ...(tenantId ? { tenantId: validId(tenantId, "Negocio") } : {}) })
    .select("proofs").lean() as Pick<InvoiceLean, "proofs"> | null;
  const proof = invoice?.proofs?.find((p) => p._id.equals(pid));
  if (!proof) throw new ServiceError(404, "Comprobante no encontrado");
  const url = await signPrivateUrl(proof.path, VIEW_URL_SECONDS);
  if (!url) throw new ServiceError(404, "El archivo ya no está disponible");
  return url;
}

// ── El superadmin ───────────────────────────────────────────────────────────

/** Filtro de la fila "Por revisar": comprobante esperando en un mes que todavía se cobra. */
export const REVIEW_QUEUE_FILTER = { "review.status": "submitted", status: { $in: OPEN } };

export async function reviewQueueCount(): Promise<number> {
  await connectToDatabase();
  return Payment.countDocuments(REVIEW_QUEUE_FILTER);
}

/** Una factura con sus comprobantes, para el diálogo de revisión. */
export async function invoiceForReview(paymentId: string) {
  const id = validId(paymentId, "Factura");
  await connectToDatabase();
  const inv = await Payment.findById(id).lean() as InvoiceLean | null;
  if (!inv) throw new ServiceError(404, "Factura no encontrada");
  const tenant = await Tenant.findById(inv.tenantId).select("name slug status").lean() as { name: string; slug: string; status: string } | null;
  const status = ownerStatusOf(inv);
  return {
    id: String(inv._id),
    tenantId: String(inv.tenantId),
    tenantName: tenant?.name ?? inv.tenantName,
    tenantSlug: tenant?.slug ?? inv.tenantSlug,
    tenantStatus: tenant?.status ?? "",
    period: periodLabel(inv.periodYear, inv.periodMonth),
    plan: PLAN_LABELS[inv.plan as PlanKey] ?? inv.plan,
    amount: inv.amount,
    listAmount: inv.listAmount ?? inv.amount,
    discountAmount: inv.discountAmount ?? 0,
    discountLabel: inv.discountLabel ?? "",
    status: inv.status,
    ownerStatus: status,
    dueDate: formatCrDate(inv.dueDate),
    paidAt: inv.paidAt ? formatCrDate(inv.paidAt) : null,
    method: inv.method ? proofMethodLabel(inv.method) : "",
    reference: inv.reference ?? "",
    review: {
      status: inv.review?.status ?? "none",
      reason: inv.review?.reason ?? "",
      reviewedAt: inv.review?.reviewedAt ? crDateTime(inv.review.reviewedAt) : null,
      reviewedBy: inv.review?.reviewedBy ?? "",
    },
    canReview: canReview(inv),
    proofs: [...(inv.proofs ?? [])]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map((p) => ({
        id: String(p._id),
        url: `/api/superadmin/pagos/${String(inv._id)}/comprobantes/${String(p._id)}`,
        isPdf: p.contentType === "application/pdf",
        paidOn: formatCrDate(p.paidOn),
        method: proofMethodLabel(p.method),
        reference: p.reference,
        note: p.note,
        uploadedAt: crDateTime(p.uploadedAt),
        uploadedBy: p.uploadedBy,
        status: p.status,
        rejectReason: p.rejectReason,
      })),
  };
}

/** Aprueba los comprobantes que esperaban revisión: registra el pago con los datos del último. */
export async function approveProofs(paymentId: string, reviewedBy: string) {
  const id = validId(paymentId, "Factura");
  await connectToDatabase();
  const inv = await Payment.findById(id).lean() as InvoiceLean | null;
  if (!inv) throw new ServiceError(404, "Factura no encontrada");
  if (!canReview(inv)) throw new ServiceError(409, "No hay un comprobante esperando revisión en este mes");
  const latest = (inv.proofs ?? [])
    .filter((p) => p.status === "submitted")
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];

  const result = await markPaid(
    paymentId,
    { method: latest?.method ?? "", reference: latest?.reference ?? "", paidAt: (latest?.paidOn ?? new Date()).toISOString() },
    reviewedBy,
  );
  await notifyOwner("approved", inv).catch((err) => console.error("[mensualidad] Aviso al dueño:", err));
  return { reactivated: result.reactivated };
}

/** Rechaza los comprobantes que esperaban revisión. El dueño ve el motivo y puede subir otro. */
export async function rejectProofs(paymentId: string, rawReason: unknown, reviewedBy: string, now = new Date()) {
  const id = validId(paymentId, "Factura");
  const reason = text(rawReason, PROOF_LIMITS.reason, "Motivo");
  if (reason.length < 3) throw new ServiceError(400, "Escribí el motivo para que el negocio sepa qué corregir");
  await connectToDatabase();
  const inv = await Payment.findById(id).lean() as InvoiceLean | null;
  if (!inv) throw new ServiceError(404, "Factura no encontrada");
  if (!canReview(inv)) throw new ServiceError(409, "No hay un comprobante esperando revisión en este mes");

  const r = await Payment.updateOne(
    { _id: id, ...REVIEW_QUEUE_FILTER },
    {
      $set: {
        "proofs.$[p].status": "rejected", "proofs.$[p].rejectReason": reason,
        "review.status": "rejected", "review.reviewedAt": now, "review.reviewedBy": reviewedBy,
        "review.reason": reason, "review.ownerSeenAt": null,
      },
    },
    { arrayFilters: [{ "p.status": "submitted" }] },
  );
  if (r.modifiedCount !== 1) throw new ServiceError(409, "Este mes cambió mientras lo revisabas. Recargá la página.");
  await notifyOwner("rejected", inv, reason).catch((err) => console.error("[mensualidad] Aviso al dueño:", err));
  return { ok: true };
}

/**
 * Al devolver a pendiente una factura que se pagó con comprobantes, esos comprobantes vuelven a
 * "por revisar": así no queda un mes sin pagar con un comprobante marcado como aprobado.
 */
export async function reopenProofs(paymentId: string) {
  const id = validId(paymentId, "Factura");
  await connectToDatabase();
  await Payment.updateOne(
    { _id: id, status: { $in: OPEN }, "proofs.status": "approved" },
    {
      $set: {
        "proofs.$[p].status": "submitted",
        "review.status": "submitted", "review.reviewedAt": null, "review.reviewedBy": "", "review.ownerSeenAt": null,
      },
    },
    { arrayFilters: [{ "p.status": "approved" }] },
  );
}

/** Cuadrícula de negocios por meses: el estado de cada mensualidad en los últimos `months` meses. */
export async function paymentsGrid(months = 12, now = new Date()) {
  await connectToDatabase();
  const count = Math.min(24, Math.max(3, Math.floor(months)));
  const { y, m } = crDay(now);
  const periods: { y: number; m: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = crDay(crMidnight(y, m - i, 1));
    periods.push({ y: d.y, m: d.m });
  }
  // Si alguien ya pagó el mes que viene, también se ve.
  const next = nextPeriod(y, m);
  const first = periods[0];

  const [tenants, invoices] = await Promise.all([
    Tenant.find().select("_id name slug status").lean() as unknown as Promise<{ _id: mongoose.Types.ObjectId; name: string; slug: string; status: string }[]>,
    Payment.find({ $or: [{ periodYear: { $gt: first.y } }, { periodYear: first.y, periodMonth: { $gte: first.m } }] })
      .select("tenantId periodYear periodMonth amount status review.status").lean() as unknown as Promise<InvoiceLean[]>,
  ]);
  if (invoices.some((i) => i.periodYear === next.y && i.periodMonth === next.m)) periods.push(next);

  const cells = new Map<string, InvoiceLean>();
  for (const inv of invoices) cells.set(`${inv.tenantId}:${inv.periodYear * 100 + inv.periodMonth}`, inv);

  const statusOrder: Record<string, number> = { active: 0, suspended: 1, inactive: 2 };
  return {
    periods: periods.map((p) => ({ key: p.y * 100 + p.m, label: `${MONTHS_SHORT[p.m - 1]} ${String(p.y).slice(2)}`, title: periodLabel(p.y, p.m) })),
    rows: tenants
      .sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) || a.name.localeCompare(b.name, "es"))
      .map((t) => ({
        id: String(t._id),
        name: t.name,
        slug: t.slug,
        status: t.status,
        cells: periods.map((p) => {
          const inv = cells.get(`${t._id}:${p.y * 100 + p.m}`);
          return inv ? { id: String(inv._id), status: ownerStatusOf(inv), amount: inv.amount } : null;
        }),
      })),
  };
}

// ── Correos ─────────────────────────────────────────────────────────────────

async function notifySuperadmin(inv: InvoiceLean, proof: { paidOn: Date; method: string; reference: string; note: string; uploadedBy: string }) {
  const { recipients } = await getAlertSettings();
  if (!recipients?.length) return;
  const tenant = await Tenant.findById(inv.tenantId).select("name").lean() as { name: string } | null;
  const tenantName = tenant?.name ?? inv.tenantName;
  const period = periodLabel(inv.periodYear, inv.periodMonth);
  const rows = [
    { label: "Mensualidad", value: formatCRC(inv.amount) },
    { label: "Fecha del pago", value: formatCrDate(proof.paidOn) },
    { label: "Método", value: proofMethodLabel(proof.method) },
    ...(proof.reference ? [{ label: "Referencia", value: proof.reference }] : []),
    ...(proof.note ? [{ label: "Nota", value: proof.note }] : []),
    { label: "Lo subió", value: proof.uploadedBy },
  ];
  const html = proofSubmittedEmailHtml({ tenantName, period, rows, reviewUrl: `${getBaseUrl()}/superadmin/pagos?tab=revisar` });
  await Promise.all(recipients.map((to) => sendMail({ to, subject: `Comprobante de ${tenantName}: ${period}`, html })));
}

async function notifyOwner(kind: "approved" | "rejected", inv: InvoiceLean, reason = "") {
  const tenant = await Tenant.findById(inv.tenantId).select("name email slug").lean() as { name: string; email: string; slug: string } | null;
  if (!tenant?.email) return;
  const period = periodLabel(inv.periodYear, inv.periodMonth);
  const panelUrl = `${getBaseUrl()}/${tenant.slug}/admin/mensualidad`;
  const name = `<strong>${escapeHtml(tenant.name)}</strong>`;
  const rows = [{ label: `Mensualidad de ${period}`, value: formatCRC(inv.listAmount ?? inv.amount) }];
  if ((inv.discountAmount ?? 0) > 0) rows.push({ label: inv.discountLabel || "Descuento", value: `−${formatCRC(inv.discountAmount ?? 0)}` });

  if (kind === "approved") {
    await sendMail({
      to: tenant.email,
      subject: `Recibimos tu pago de ${period}`,
      html: billingEmailHtml({
        title: "Pago verificado",
        intro: `Hola, ${name}. Verificamos el pago de tu mensualidad de <strong>${escapeHtml(period)}</strong>. ¡Gracias!`,
        rows, totalLabel: "Pagado", totalValue: formatCRC(inv.amount), payment: null, panelUrl,
      }),
    });
    return;
  }
  const settings = await getBillingSettings();
  const pay = settings.payment;
  const hasPayment = Boolean(pay.sinpeNumber || pay.iban || pay.whatsapp || pay.notes);
  await sendMail({
    to: tenant.email,
    subject: `Revisá el comprobante de ${period}`,
    html: billingEmailHtml({
      title: "Revisá tu comprobante",
      intro: `Hola, ${name}. Revisamos el comprobante de tu mensualidad de <strong>${escapeHtml(period)}</strong> y todavía no podemos darlo por bueno.`,
      rows, totalLabel: "Total a pagar", totalValue: formatCRC(inv.amount),
      note: `<strong>Motivo:</strong> ${escapeHtml(reason)}<br/>Podés subir otro comprobante en Mensualidad, dentro de tu panel.`,
      payment: hasPayment ? pay : null, panelUrl,
    }),
  });
}
