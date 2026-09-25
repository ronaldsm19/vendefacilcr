import crypto from "node:crypto";
import { connectToDatabase } from "@/lib/mongodb";
import { RefreshToken, type RefreshPlatform, type RefreshUserType } from "@/models/RefreshToken";
import { AccessLog } from "@/models/AccessLog";
import { ServiceError } from "@/server/errors";
import type { AdminPayload } from "@/lib/auth";

/** 60 días: la mesera no debería volver a escribir su PIN salvo que pase mucho tiempo. */
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

const PLATFORMS: RefreshPlatform[] = ["ios", "android", "otro"];

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizePlatform(value: unknown): RefreshPlatform {
  return PLATFORMS.includes(value as RefreshPlatform) ? (value as RefreshPlatform) : "otro";
}

export interface IssueInput {
  payload: AdminPayload;
  userType: RefreshUserType;
  deviceName?: unknown;
  platform?: unknown;
}

/** Crea un token de refresco nuevo y devuelve el valor en claro (única vez que existe). */
export async function issueRefreshToken(input: IssueInput): Promise<string> {
  await connectToDatabase();
  const token = newToken();
  await RefreshToken.create({
    tenantId: input.payload.tenantId,
    userId: input.payload.userId,
    userType: input.userType,
    tokenHash: hash(token),
    deviceName: String(input.deviceName ?? "").trim().slice(0, 80),
    platform: normalizePlatform(input.platform),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return token;
}

interface StoredToken {
  _id: { toString(): string };
  tenantId: { toString(): string };
  userId: string;
  userType: RefreshUserType;
  deviceName: string;
  platform: RefreshPlatform;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string;
}

export interface RotateResult {
  stored: StoredToken;
  refreshToken: string;
}

/**
 * Valida un token de refresco y lo rota: el anterior queda marcado como reemplazado y deja de
 * servir en el acto.
 *
 * Si llega un token YA reemplazado, alguien está usando una copia vieja: o se la robaron, o el
 * teléfono guardó una versión previa. En cualquier caso se revoca toda la sesión de esa persona
 * y se la obliga a iniciar sesión otra vez. Es la única defensa real contra un token copiado.
 */
export async function rotateRefreshToken(rawToken: string): Promise<RotateResult> {
  await connectToDatabase();

  if (!rawToken || typeof rawToken !== "string") {
    throw new ServiceError(400, "Falta el token de refresco", "REFRESH_INVALID");
  }

  const stored = (await RefreshToken.findOne({ tokenHash: hash(rawToken) })
    .lean()) as StoredToken | null;

  if (!stored) {
    throw new ServiceError(401, "Sesión no válida", "REFRESH_INVALID");
  }

  if (stored.replacedBy) {
    await revokeAllForUser(stored.tenantId.toString(), stored.userId);
    AccessLog.create({
      tenantId: stored.tenantId.toString(),
      tenantSlug: "",
      userEmail: stored.userId,
      ip: "",
      userAgent: "",
      success: false,
      event: "refresh_reuse",
    }).catch(() => {});
    throw new ServiceError(401, "Sesión no válida", "REFRESH_REUSED");
  }

  if (stored.revokedAt) {
    throw new ServiceError(401, "Sesión revocada", "REFRESH_REVOKED");
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw new ServiceError(401, "Sesión vencida", "REFRESH_EXPIRED");
  }

  const next = newToken();
  const nextHash = hash(next);

  // Condicional sobre replacedBy: si dos refrescos llegan a la vez con el mismo token, solo uno
  // gana y el otro entra por la rama de reuso, que es el comportamiento correcto.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: stored._id, replacedBy: "" },
    { $set: { replacedBy: nextHash, revokedAt: new Date(), lastUsedAt: new Date() } },
    { returnDocument: "after" }
  ).lean();

  if (!claimed) {
    throw new ServiceError(401, "Sesión no válida", "REFRESH_REUSED");
  }

  await RefreshToken.create({
    tenantId: stored.tenantId,
    userId: stored.userId,
    userType: stored.userType,
    tokenHash: nextHash,
    deviceName: stored.deviceName,
    platform: stored.platform,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  return { stored, refreshToken: next };
}

/** Revoca un token puntual. No falla si no existe: cerrar sesión siempre "funciona". */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  if (!rawToken || typeof rawToken !== "string") return;
  await connectToDatabase();
  await RefreshToken.updateOne(
    { tokenHash: hash(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

/** Revoca todas las sesiones de una persona. Se usa al desactivarla o al cambiarle el PIN. */
export async function revokeAllForUser(tenantId: string, userId: string): Promise<number> {
  await connectToDatabase();
  const res = await RefreshToken.updateMany(
    { tenantId, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return res.modifiedCount ?? 0;
}

/** Revoca un dispositivo por su id, validando que sea del tenant. */
export async function revokeDevice(tenantId: string, deviceId: string): Promise<boolean> {
  await connectToDatabase();
  const res = await RefreshToken.updateOne(
    { _id: deviceId, tenantId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return (res.modifiedCount ?? 0) > 0;
}

export interface DeviceView {
  id: string;
  userId: string;
  deviceName: string;
  platform: RefreshPlatform;
  lastUsedAt: string;
  createdAt: string;
}

/** Dispositivos con sesión viva de un tenant, opcionalmente filtrados por persona. */
export async function listDevices(tenantId: string, userId?: string): Promise<DeviceView[]> {
  await connectToDatabase();
  const query: Record<string, unknown> = {
    tenantId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  };
  if (userId) query.userId = userId;

  const rows = (await RefreshToken.find(query)
    .select("_id userId deviceName platform lastUsedAt createdAt")
    .sort({ lastUsedAt: -1 })
    .limit(100)
    .lean()) as unknown as (StoredToken & { lastUsedAt: Date; createdAt: Date })[];

  return rows.map((r) => ({
    id: r._id.toString(),
    userId: r.userId,
    deviceName: r.deviceName || "Dispositivo sin nombre",
    platform: r.platform,
    lastUsedAt: r.lastUsedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}
