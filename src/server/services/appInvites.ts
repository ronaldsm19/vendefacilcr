import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import {
  AppInvite,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_CODE_RE,
  normalizeInviteCode,
} from "@/models/AppInvite";
import { StaffUser } from "@/models/StaffUser";
import { Tenant } from "@/models/Tenant";
import { ServiceError } from "@/server/errors";

/**
 * Invitaciones para vincular el teléfono de un empleado con el negocio.
 *
 * Ver el comentario de models/AppInvite.ts para por qué el código se guarda en claro y por qué
 * no es una credencial.
 */

export const INVITE_MAX_DAYS = 90;
export const INVITE_DEFAULT_DAYS = 7;

/** Código aleatorio con el alfabeto sin caracteres confundibles. */
function generateCode(): string {
  // randomInt en vez de Math.random: el código va en un QR que se pega en la cocina y no
  // cuesta nada que sea impredecible de verdad.
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
  }
  return out;
}

export interface InviteView {
  _id: string;
  code: string;
  staffUserId: string;
  staffName: string;
  staffUsername: string;
  createdByName: string;
  expiresAt: string;
  usedCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface InviteDoc {
  _id: mongoose.Types.ObjectId;
  code: string;
  staffUserId?: string;
  createdByName?: string;
  expiresAt: Date;
  usedCount?: number;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

function toView(doc: InviteDoc, staff: Map<string, { name: string; username: string }>): InviteView {
  const s = doc.staffUserId ? staff.get(doc.staffUserId) : undefined;
  return {
    _id: String(doc._id),
    code: doc.code,
    staffUserId: doc.staffUserId ?? "",
    staffName: s?.name ?? "",
    staffUsername: s?.username ?? "",
    createdByName: doc.createdByName ?? "",
    expiresAt: doc.expiresAt.toISOString(),
    usedCount: doc.usedCount ?? 0,
    lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Invitaciones vigentes del negocio, la más nueva primero. */
export async function listInvites(tenantId: string): Promise<InviteView[]> {
  await connectToDatabase();
  const docs = await AppInvite.find({
    tenantId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean<InviteDoc[]>();

  const ids = docs.map((d) => d.staffUserId).filter(Boolean);
  const staffDocs = ids.length
    ? await StaffUser.find({ tenantId, _id: { $in: ids } }).select("name username").lean<
        { _id: mongoose.Types.ObjectId; name: string; username: string }[]
      >()
    : [];
  const staff = new Map(staffDocs.map((s) => [String(s._id), { name: s.name, username: s.username }]));

  return docs.map((d) => toView(d, staff));
}

/**
 * Crea una invitación. `staffUserId` vacío = para todo el negocio; con empleado, la app le
 * adelanta el usuario y solo le queda marcar el PIN.
 */
export async function createInvite(params: {
  tenantId: string;
  staffUserId?: string;
  days?: number;
  createdByName?: string;
}): Promise<InviteView> {
  await connectToDatabase();

  const { tenantId } = params;
  const days = Math.min(INVITE_MAX_DAYS, Math.max(1, Math.round(params.days ?? INVITE_DEFAULT_DAYS)));
  let staffUserId = String(params.staffUserId ?? "").trim();

  if (staffUserId) {
    if (!mongoose.isValidObjectId(staffUserId)) {
      throw new ServiceError(400, "Empleado inválido");
    }
    // Se comprueba contra el tenant de la sesión: sin esto, un administrador podría emitir una
    // invitación apuntando al empleado de otro negocio.
    const owned = await StaffUser.exists({ _id: staffUserId, tenantId, active: true });
    if (!owned) throw new ServiceError(404, "El empleado no existe o está inactivo");
  } else {
    staffUserId = "";
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // El código es único en toda la colección. La probabilidad de chocar es ínfima, pero si pasa
  // se reintenta en vez de devolverle un error al administrador.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await AppInvite.create({
        tenantId,
        code: generateCode(),
        staffUserId,
        createdByName: (params.createdByName ?? "").slice(0, 80),
        expiresAt,
      });
      const staff = new Map<string, { name: string; username: string }>();
      if (staffUserId) {
        const s = await StaffUser.findById(staffUserId).select("name username").lean<{ name: string; username: string } | null>();
        if (s) staff.set(staffUserId, { name: s.name, username: s.username });
      }
      return toView(created.toObject() as InviteDoc, staff);
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  throw new ServiceError(500, "No se pudo generar el código, intentá de nuevo");
}

export async function revokeInvite(tenantId: string, id: string): Promise<void> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) throw new ServiceError(404, "La invitación no existe");
  const res = await AppInvite.updateOne(
    { _id: id, tenantId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (res.matchedCount === 0) throw new ServiceError(404, "La invitación no existe");
}

export interface ResolvedInvite {
  tenant: { slug: string; name: string; theme: { primaryColor: string; secondaryColor: string; accentColor: string } };
  /** Usuario que la app puede adelantar, o "" si la invitación es del negocio entero. */
  username: string;
  staffName: string;
}

/**
 * Canjea un código por el negocio al que apunta. Es la única parte pública de todo esto.
 *
 * Solo devuelve lo que la app necesita para pintarse y apuntar al servidor correcto; no
 * devuelve ni un token ni una sesión. El mismo mensaje de error para código inexistente,
 * vencido, revocado o de un negocio dado de baja: distinguirlos le diría a quien pruebe
 * códigos al azar cuáles existen.
 */
export async function resolveInvite(rawCode: string): Promise<ResolvedInvite> {
  const code = normalizeInviteCode(String(rawCode ?? ""));
  const notFound = new ServiceError(404, "El código no es válido o ya venció", "INVITE_INVALID");
  if (!INVITE_CODE_RE.test(code)) throw notFound;

  await connectToDatabase();
  const invite = await AppInvite.findOne({
    code,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select("tenantId staffUserId")
    .lean<{ _id: mongoose.Types.ObjectId; tenantId: mongoose.Types.ObjectId; staffUserId?: string } | null>();
  if (!invite) throw notFound;

  const tenant = await Tenant.findById(invite.tenantId)
    .select("slug name status theme")
    .lean<{ slug: string; name: string; status?: string; theme?: { primaryColor?: string; secondaryColor?: string; accentColor?: string } } | null>();
  if (!tenant || tenant.status !== "active") throw notFound;

  let username = "";
  let staffName = "";
  if (invite.staffUserId) {
    const s = await StaffUser.findOne({ _id: invite.staffUserId, tenantId: invite.tenantId, active: true })
      .select("name username")
      .lean<{ name: string; username: string } | null>();
    // Si el empleado fue borrado o desactivado, la invitación sigue sirviendo para el negocio:
    // deja de adelantar el usuario y nada más.
    if (s) {
      username = s.username;
      staffName = s.name;
    }
  }

  // El contador es informativo para el administrador ("ya la usaron 3 veces"), así que no vale
  // la pena que un fallo al escribirlo tumbe el canje.
  AppInvite.updateOne({ _id: invite._id }, { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } })
    .exec()
    .catch(() => {});

  return {
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      theme: {
        primaryColor: tenant.theme?.primaryColor ?? "#6366F1",
        secondaryColor: tenant.theme?.secondaryColor ?? "#8B5CF6",
        accentColor: tenant.theme?.accentColor ?? "#F59E0B",
      },
    },
    username,
    staffName,
  };
}
