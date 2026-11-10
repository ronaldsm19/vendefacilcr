import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { TenantNotice, type ITenantNotice } from "@/models/TenantNotice";
import { NoticeRead } from "@/models/NoticeRead";
import { ServiceError } from "@/server/errors";
import { ownerBillingView } from "@/server/services/billing";
import { crMidnight } from "@/lib/billing";
import { isNoticeKind, NOTICE_LIMITS, type NoticeRoles } from "@/lib/notices";
import type { AdminPayload } from "@/lib/auth";

/**
 * Avisos dentro del panel del negocio. Dos fuentes:
 * - El aviso de cobro, que se calcula solo: sale cuando la mensualidad está por vencer o vencida.
 *   Solo lo ve el dueño.
 * - Los avisos que escribe el superadmin, para todos los negocios o para algunos.
 */

type NoticeLean = ITenantNotice & { _id: mongoose.Types.ObjectId };

const isOwner = (session: AdminPayload) => session.role === "admin";

/** Los avisos vigentes que le tocan a esta sesión (por negocio y por rol). */
function visibleFilter(session: AdminPayload, now: Date) {
  const tenantId = new mongoose.Types.ObjectId(session.tenantId);
  return {
    active: true,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ audience: "all" }, { tenantIds: tenantId }] },
    ],
    ...(isOwner(session) ? {} : { roles: "all" }),
  };
}

/** Lo que el panel del negocio tiene que mostrarle a quien está adentro. */
export async function noticesForSession(session: AdminPayload, now = new Date()) {
  if (!mongoose.isValidObjectId(session.tenantId)) throw new ServiceError(401, "No autorizado");
  await connectToDatabase();

  const [notices, plan] = await Promise.all([
    TenantNotice.find(visibleFilter(session, now)).sort({ createdAt: -1 }).limit(20).lean() as unknown as Promise<NoticeLean[]>,
    // Un problema con el cobro no puede dejar al panel sin los demás avisos.
    isOwner(session) ? ownerBillingView(session.tenantId, now).catch(() => null) : Promise.resolve(null),
  ]);
  const reads = await NoticeRead.find({ noticeId: { $in: notices.map((n) => n._id) }, userId: session.userId })
    .select("noticeId").lean() as unknown as { noticeId: mongoose.Types.ObjectId }[];
  const seen = new Set(reads.map((r) => String(r.noticeId)));

  const invoice = plan?.invoice ?? null;
  return {
    /** Mensualidad por vencer o vencida (solo el dueño, y solo con el cobro automático encendido). */
    billing: plan && invoice?.dueSoon
      ? { ...invoice, planLabel: plan.planLabel, price: plan.price, payment: plan.payment }
      : null,
    /** Para los avisos de tipo cobro: lo que paga el negocio y cómo pagar. */
    plan: plan ? { planLabel: plan.planLabel, price: plan.price, payment: plan.payment } : null,
    notices: notices.map((n) => ({
      id: String(n._id),
      kind: n.kind,
      title: n.title,
      body: n.body,
      showEveryLogin: n.showEveryLogin,
      seen: seen.has(String(n._id)),
      createdAt: n.createdAt,
    })),
  };
}

/** Deja constancia de que esta persona vio (cerró) un aviso. */
export async function markNoticeSeen(session: AdminPayload, noticeId: string, now = new Date()) {
  if (!mongoose.isValidObjectId(noticeId)) throw new ServiceError(404, "Aviso no encontrado");
  await connectToDatabase();
  // Solo se registra si el aviso de verdad le toca a esta sesión.
  const notice = await TenantNotice.exists({ _id: noticeId, ...visibleFilter(session, now) });
  if (!notice) throw new ServiceError(404, "Aviso no encontrado");
  await NoticeRead.updateOne(
    { noticeId: new mongoose.Types.ObjectId(noticeId), userId: session.userId },
    {
      $setOnInsert: { tenantId: new mongoose.Types.ObjectId(session.tenantId), firstSeenAt: now },
      $set: { lastSeenAt: now, userName: session.name, role: session.role },
      $inc: { count: 1 },
    },
    { upsert: true },
  );
  return { ok: true };
}

// ── Superadmin ──────────────────────────────────────────────────────────────

function text(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== "string") throw new ServiceError(400, `${label}: texto inválido`);
  const t = value.trim();
  if (t.length < min) throw new ServiceError(400, `${label}: ${min === 1 ? "no puede estar vacío" : `mínimo ${min} caracteres`}`);
  if (t.length > max) throw new ServiceError(400, `${label}: hasta ${max} caracteres`);
  return t;
}

/** Crea un aviso. `expiresAt` llega como AAAA-MM-DD y vale hasta el final de ese día en Costa Rica. */
export async function createNotice(raw: Record<string, unknown>, createdBy: string, now = new Date()) {
  if (!isNoticeKind(raw.kind)) throw new ServiceError(400, "Tipo de aviso inválido");
  const title = text(raw.title, 3, NOTICE_LIMITS.title, "Título");
  const body = text(raw.body, 1, NOTICE_LIMITS.body, "Mensaje");
  if (raw.audience !== "all" && raw.audience !== "tenants") throw new ServiceError(400, "Falta indicar a quién va el aviso");
  // Un aviso de cobro habla de lo que paga el negocio: nunca lo ve el personal.
  const roles: NoticeRoles = raw.kind === "cobro" ? "owner" : raw.roles === "all" ? "all" : "owner";

  await connectToDatabase();
  let tenantIds: mongoose.Types.ObjectId[] = [];
  if (raw.audience === "tenants") {
    const ids = Array.isArray(raw.tenantIds) ? [...new Set(raw.tenantIds.filter((id): id is string => typeof id === "string"))] : [];
    if (!ids.length) throw new ServiceError(400, "Elegí al menos un negocio");
    if (ids.length > NOTICE_LIMITS.tenants || ids.some((id) => !mongoose.isValidObjectId(id))) {
      throw new ServiceError(400, "Lista de negocios inválida");
    }
    const found = await Tenant.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) throw new ServiceError(400, "Alguno de los negocios ya no existe");
    tenantIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  }

  let expiresAt: Date | null = null;
  if (raw.expiresAt) {
    const match = typeof raw.expiresAt === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.expiresAt) : null;
    if (!match) throw new ServiceError(400, "Fecha de vencimiento inválida");
    expiresAt = crMidnight(Number(match[1]), Number(match[2]), Number(match[3]) + 1);
    if (expiresAt.getTime() <= now.getTime()) throw new ServiceError(400, "La fecha de vencimiento ya pasó");
  }

  const notice = await TenantNotice.create({
    kind: raw.kind, title, body, audience: raw.audience, tenantIds, roles,
    showEveryLogin: raw.showEveryLogin === true, expiresAt, active: true, createdBy,
  });
  return { id: String(notice._id) };
}

/** Los avisos con a cuántos negocios les llega, cuántos lo vieron y quién. */
export async function listNotices(now = new Date()) {
  await connectToDatabase();
  const [notices, tenants] = await Promise.all([
    TenantNotice.find({}).sort({ createdAt: -1 }).limit(100).lean() as unknown as Promise<NoticeLean[]>,
    Tenant.find({}).select("name slug status").sort({ name: 1 }).lean() as unknown as Promise<{ _id: mongoose.Types.ObjectId; name: string; slug: string; status: string }[]>,
  ]);
  const reads = await NoticeRead.find({ noticeId: { $in: notices.map((n) => n._id) } }).sort({ firstSeenAt: 1 }).lean() as unknown as
    { noticeId: mongoose.Types.ObjectId; tenantId: mongoose.Types.ObjectId; userName: string; role: string; firstSeenAt: Date; lastSeenAt: Date; count: number }[];

  const names = new Map(tenants.map((t) => [String(t._id), t.name || t.slug]));
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const byNotice = new Map<string, typeof reads>();
  for (const r of reads) {
    const key = String(r.noticeId);
    byNotice.set(key, [...(byNotice.get(key) ?? []), r]);
  }

  return {
    tenants: tenants.map((t) => ({ id: String(t._id), name: t.name || t.slug, status: t.status })),
    notices: notices.map((n) => {
      const own = byNotice.get(String(n._id)) ?? [];
      return {
        id: String(n._id),
        kind: n.kind,
        title: n.title,
        body: n.body,
        audience: n.audience,
        tenantNames: n.tenantIds.map((id) => names.get(String(id)) ?? "Negocio borrado"),
        roles: n.roles,
        showEveryLogin: n.showEveryLogin,
        expiresAt: n.expiresAt,
        active: n.active,
        expired: Boolean(n.expiresAt && n.expiresAt.getTime() <= now.getTime()),
        createdBy: n.createdBy,
        createdAt: n.createdAt,
        recipients: n.audience === "all" ? activeCount : n.tenantIds.length,
        seenTenants: new Set(own.map((r) => String(r.tenantId))).size,
        reads: own.slice(0, 50).map((r) => ({
          tenantName: names.get(String(r.tenantId)) ?? "Negocio borrado",
          userName: r.userName, role: r.role, firstSeenAt: r.firstSeenAt, lastSeenAt: r.lastSeenAt, count: r.count,
        })),
      };
    }),
  };
}

export async function setNoticeActive(noticeId: string, active: unknown) {
  if (!mongoose.isValidObjectId(noticeId)) throw new ServiceError(404, "Aviso no encontrado");
  if (typeof active !== "boolean") throw new ServiceError(400, "Falta indicar si el aviso queda activo");
  await connectToDatabase();
  const r = await TenantNotice.updateOne({ _id: noticeId }, { $set: { active } });
  if (!r.matchedCount) throw new ServiceError(404, "Aviso no encontrado");
  return { ok: true };
}

export async function deleteNotice(noticeId: string) {
  if (!mongoose.isValidObjectId(noticeId)) throw new ServiceError(404, "Aviso no encontrado");
  await connectToDatabase();
  const r = await TenantNotice.deleteOne({ _id: noticeId });
  if (!r.deletedCount) throw new ServiceError(404, "Aviso no encontrado");
  await NoticeRead.deleteMany({ noticeId: new mongoose.Types.ObjectId(noticeId) });
  return { ok: true };
}
