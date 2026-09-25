import mongoose, { Schema } from "mongoose";

/**
 * Token de refresco de la app móvil. El token de acceso dura una hora; este permite renovarlo
 * sin volver a pedir el PIN.
 *
 * Nunca se guarda el token en claro, solo su SHA-256. Con 32 bytes aleatorios no hace falta
 * bcrypt: el valor ya es impredecible, y bcrypt solo agregaría latencia en cada refresco.
 */

export type RefreshUserType = "admin" | "staff";
export type RefreshPlatform = "ios" | "android" | "otro";

export interface IRefreshToken {
  _id: string;
  tenantId: string;
  userId: string;
  userType: RefreshUserType;
  tokenHash: string;
  deviceName: string;
  platform: RefreshPlatform;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Hash del token que lo sucedió al rotar. Sirve para detectar reuso. */
  replacedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema(
  {
    tenantId:   { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId:     { type: String, required: true },
    userType:   { type: String, enum: ["admin", "staff"], required: true },
    tokenHash:  { type: String, required: true, unique: true },
    deviceName: { type: String, default: "", trim: true, maxlength: 80 },
    platform:   { type: String, enum: ["ios", "android", "otro"], default: "otro" },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt:  { type: Date, required: true },
    revokedAt:  { type: Date, default: null },
    replacedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

RefreshTokenSchema.index({ tenantId: 1, userId: 1, revokedAt: 1 });
// TTL: Mongo borra solo los documentos vencidos, así la colección no crece para siempre.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>("RefreshToken", RefreshTokenSchema);
