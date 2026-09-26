import mongoose, { Schema } from "mongoose";

/**
 * Invitación para vincular un teléfono con el negocio en la app del mesero.
 *
 * Sin esto, el empleado tiene que escribir a mano el identificador del restaurante en la
 * pantalla de inicio — un dato técnico que hay que dictarle por teléfono y que, mal escrito,
 * deja la app sin servir. Con la invitación el administrador genera un código, el empleado lo
 * escanea y el teléfono queda apuntando al negocio correcto.
 *
 * El código NO es una credencial: no inicia sesión ni da acceso a nada. Lo único que revela es
 * a qué restaurante pertenece, y eso ya es público (la tienda del negocio lo es). Después de
 * escanear, el empleado sigue teniendo que entrar con su usuario y su PIN. Por eso se guarda
 * en claro: el administrador necesita poder volver a mostrar el mismo QR para reimprimirlo.
 */

export interface IAppInvite {
  _id: string;
  tenantId: string;
  /** Código normalizado: mayúsculas, sin guiones. Lo que viaja dentro del QR. */
  code: string;
  /** Empleado al que pertenece la invitación, o "" si es del negocio entero. */
  staffUserId: string;
  /** Nombre visible de quien la creó, para la lista del administrador. */
  createdByName: string;
  expiresAt: Date;
  revokedAt: Date | null;
  usedCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AppInviteSchema = new Schema(
  {
    tenantId:      { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    code:          { type: String, required: true, unique: true, uppercase: true, trim: true },
    staffUserId:   { type: String, default: "" },
    createdByName: { type: String, default: "", trim: true, maxlength: 80 },
    expiresAt:     { type: Date, required: true },
    revokedAt:     { type: Date, default: null },
    usedCount:     { type: Number, default: 0 },
    lastUsedAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

AppInviteSchema.index({ tenantId: 1, createdAt: -1 });
// TTL: Mongo borra las vencidas solo. Una invitación caducada no sirve para nada y guardarla
// para siempre solo haría crecer la colección.
AppInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Alfabeto sin letras ni números que se confundan al leerlos de una pantalla o dictarlos por
 * teléfono: se quitaron I, L, O, U, 0 y 1.
 */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/;

/** Quita guiones y espacios y pasa a mayúsculas: "vf2k-9xrt" y "VF2K 9XRT" son el mismo código. */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** Formato para mostrar y dictar: cuatro y cuatro. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export const AppInvite =
  mongoose.models.AppInvite || mongoose.model<IAppInvite>("AppInvite", AppInviteSchema);
