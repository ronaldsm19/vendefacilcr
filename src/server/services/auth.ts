import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { StaffUser, USERNAME_RE, PIN_RE } from "@/models/StaffUser";
import { AccessLog } from "@/models/AccessLog";
import { ServiceError } from "@/server/errors";
import { isPremiumPlan, homePathFor, ERROR_PREMIUM, type Role } from "@/lib/permissions";
import { consumeAttempt, clearAttempts } from "@/server/services/rateLimit";
import type { AdminPayload } from "@/lib/auth";

/**
 * Autenticación compartida por la web (cookie) y la app móvil (token).
 *
 * Vive acá y no en el route handler porque son dos ramas distintas (admin con correo y
 * contraseña, staff con usuario y PIN) más límite de intentos, tenant activo y compuerta de
 * plan premium. Duplicar eso en el endpoint de la app sería garantizar que un día las dos
 * puertas validen cosas distintas.
 */

// ── Límite de intentos (contadores en MongoDB, ver server/services/rateLimit) ──
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

// Admin (correo + contraseña): normalmente una sola persona por tenant, el límite por IP
// se queda en 5 cada 15 min.
const MAX_ATTEMPTS_IP_ADMIN = 5;
// Staff (usuario + PIN): se evalúa primero el contador de la cuenta (5) y solo después el de
// la IP (30). En un restaurante todo el equipo comparte una conexión, y con PINs de 4 dígitos
// 5 errores repartidos dejarían afuera al local entero.
const MAX_ATTEMPTS_USER = 5;
const MAX_ATTEMPTS_IP_STAFF = 30;

export const ERROR_CREDENTIALS = "Credenciales incorrectas";
export const ERROR_INACTIVE = "Tu cuenta está inactiva. Contactá a VendeFácil.";
export const ERROR_TOO_MANY = "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.";
export const ERROR_TOO_MANY_USER =
  "Demasiados intentos fallidos para este usuario. Intentá de nuevo en 15 minutos.";

export interface AuthInput {
  login: string;
  password: string;
  tenantSlug?: string;
  ip: string;
  userAgent: string;
}

export interface AuthResult {
  payload: AdminPayload;
  /** Datos que las dos puertas devuelven al cliente. */
  tenant: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    isPremium: boolean;
    passwordChanged: boolean;
    theme: { primaryColor: string; secondaryColor: string; accentColor: string };
  };
  redirectTo: string;
  /** "admin" (modelo User) o "staff" (modelo StaffUser). Lo necesita el token de refresco. */
  userType: "admin" | "staff";
}

interface IUserLean {
  _id: { toString(): string };
  email: string;
  password: string;
  tenantId?: { toString(): string };
}

interface ITenantLean {
  _id: { toString(): string };
  slug: string;
  name?: string;
  status: string;
  plan?: string;
  passwordChanged?: boolean;
  ticketConfig?: { ownerName?: string };
  theme?: { primaryColor?: string; secondaryColor?: string; accentColor?: string };
}

interface IStaffUserLean {
  _id: { toString(): string };
  name: string;
  username: string;
  pinHash: string;
  role: Role;
  active: boolean;
}

/** Demora fija ante credenciales inválidas, para no delatar qué parte falló por el tiempo. */
function slowDown(): Promise<void> {
  return new Promise((r) => setTimeout(r, 500));
}

function tenantView(t: ITenantLean): AuthResult["tenant"] {
  return {
    id: t._id.toString(),
    slug: t.slug,
    name: t.name ?? t.slug,
    plan: t.plan ?? "emprende",
    isPremium: isPremiumPlan(t.plan),
    passwordChanged: t.passwordChanged ?? false,
    theme: {
      primaryColor: t.theme?.primaryColor ?? "#6366F1",
      secondaryColor: t.theme?.secondaryColor ?? "#8B5CF6",
      accentColor: t.theme?.accentColor ?? "#F59E0B",
    },
  };
}

function logAttempt(
  tenantId: string,
  tenantSlug: string,
  userEmail: string,
  input: AuthInput,
  success: boolean
) {
  AccessLog.create({
    tenantId,
    tenantSlug,
    userEmail,
    ip: input.ip,
    userAgent: input.userAgent,
    success,
    event: "login",
  }).catch(() => {});
}

/**
 * Valida las credenciales y devuelve el payload de sesión.
 * Lanza ServiceError con el status que corresponde; nunca devuelve una respuesta HTTP.
 */
export async function authenticate(input: AuthInput): Promise<AuthResult> {
  const login = input.login.trim();
  if (!login || !input.password) {
    throw new ServiceError(400, "Usuario y contraseña son requeridos");
  }

  await connectToDatabase();

  return login.includes("@") ? authenticateAdmin(login, input) : authenticateStaff(login, input);
}

async function authenticateAdmin(login: string, input: AuthInput): Promise<AuthResult> {
  const ipKey = `admin-ip:${input.ip}`;
  if (!(await consumeAttempt(ipKey, MAX_ATTEMPTS_IP_ADMIN, WINDOW_MS))) {
    throw new ServiceError(429, ERROR_TOO_MANY);
  }

  const email = login.toLowerCase();
  const user = (await User.findOne({ email }).lean()) as IUserLean | null;

  if (!user) {
    if (input.tenantSlug) {
      const t = (await Tenant.findOne({ slug: input.tenantSlug }).lean()) as ITenantLean | null;
      if (t) logAttempt(t._id.toString(), input.tenantSlug, email, input, false);
    }
    await slowDown();
    throw new ServiceError(401, ERROR_CREDENTIALS);
  }

  if (!(await bcrypt.compare(input.password, user.password))) {
    if (user.tenantId) {
      const t = (await Tenant.findById(user.tenantId).lean()) as ITenantLean | null;
      if (t) logAttempt(t._id.toString(), t.slug, user.email, input, false);
    }
    await slowDown();
    throw new ServiceError(401, ERROR_CREDENTIALS);
  }

  if (!user.tenantId) {
    throw new ServiceError(403, "Usuario sin tenant asignado. Contactá al administrador.");
  }

  const tenant = (await Tenant.findById(user.tenantId).lean()) as ITenantLean | null;
  if (!tenant) throw new ServiceError(403, "Tenant no encontrado");
  if (tenant.status !== "active") throw new ServiceError(403, ERROR_INACTIVE);

  // El slug de la URL tiene que ser el del usuario: así un admin no entra por la puerta de otro.
  if (input.tenantSlug && input.tenantSlug !== tenant.slug) {
    logAttempt(tenant._id.toString(), tenant.slug, user.email, input, false);
    await slowDown();
    throw new ServiceError(401, ERROR_CREDENTIALS);
  }

  await clearAttempts(ipKey);
  logAttempt(tenant._id.toString(), tenant.slug, user.email, input, true);

  const name = tenant.ticketConfig?.ownerName?.trim() || "Administrador";

  return {
    payload: {
      role: "admin",
      tenantId: tenant._id.toString(),
      tenantSlug: tenant.slug,
      userId: user._id.toString(),
      name,
      email: user.email,
    },
    tenant: tenantView(tenant),
    redirectTo: `/${tenant.slug}/admin`,
    userType: "admin",
  };
}

async function authenticateStaff(login: string, input: AuthInput): Promise<AuthResult> {
  const ipKey = `staff-ip:${input.ip}`;

  if (!input.tenantSlug) throw new ServiceError(400, "Tenant requerido");

  const username = login.toLowerCase();
  const pin = String(input.password);

  if (!USERNAME_RE.test(username) || !PIN_RE.test(pin)) {
    await consumeAttempt(ipKey, MAX_ATTEMPTS_IP_STAFF, WINDOW_MS);
    await slowDown();
    throw new ServiceError(401, ERROR_CREDENTIALS);
  }

  const tenant = (await Tenant.findOne({ slug: input.tenantSlug })
    .select("_id slug name status plan theme")
    .lean()) as ITenantLean | null;

  if (!tenant) {
    await consumeAttempt(ipKey, MAX_ATTEMPTS_IP_STAFF, WINDOW_MS);
    await slowDown();
    throw new ServiceError(401, ERROR_CREDENTIALS);
  }

  const userKey = `staff-user:${tenant._id}:${username}`;

  // Se consumen los dos contadores a la vez pero se evalúa primero el de la cuenta, para que
  // quien se equivocó de PIN vea el mensaje de SU cuenta y no uno que suene a bloqueo general.
  const [userOk, ipOk] = await Promise.all([
    consumeAttempt(userKey, MAX_ATTEMPTS_USER, WINDOW_MS),
    consumeAttempt(ipKey, MAX_ATTEMPTS_IP_STAFF, WINDOW_MS),
  ]);
  if (!userOk) throw new ServiceError(429, ERROR_TOO_MANY_USER);
  if (!ipOk) throw new ServiceError(429, ERROR_TOO_MANY);

  if (tenant.status !== "active") throw new ServiceError(403, ERROR_INACTIVE);
  if (!isPremiumPlan(tenant.plan)) throw new ServiceError(403, ERROR_PREMIUM);

  const staff = (await StaffUser.findOne({
    tenantId: tenant._id,
    username,
  }).lean()) as IStaffUserLean | null;

  if (!staff || !staff.active || !(await bcrypt.compare(pin, staff.pinHash))) {
    logAttempt(tenant._id.toString(), tenant.slug, username, input, false);
    await slowDown();
    throw new ServiceError(401, ERROR_CREDENTIALS);
  }

  await Promise.all([clearAttempts(ipKey), clearAttempts(userKey)]);
  logAttempt(tenant._id.toString(), tenant.slug, username, input, true);

  return {
    payload: {
      role: staff.role,
      tenantId: tenant._id.toString(),
      tenantSlug: tenant.slug,
      userId: String(staff._id),
      name: staff.name,
    },
    tenant: tenantView(tenant),
    redirectTo: homePathFor(staff.role, `/${tenant.slug}/admin`),
    userType: "staff",
  };
}

/**
 * Revalida que una sesión siga siendo válida contra la base. La usa el refresco de token:
 * ahí es donde se hace efectiva una desactivación o una bajada de plan, porque el token de
 * acceso ya emitido no se puede retirar antes de que venza.
 */
export async function revalidateSession(payload: AdminPayload): Promise<AuthResult["tenant"]> {
  await connectToDatabase();

  const tenant = (await Tenant.findById(payload.tenantId)
    .select("_id slug name status plan theme passwordChanged")
    .lean()) as ITenantLean | null;

  if (!tenant || tenant.status !== "active") {
    throw new ServiceError(401, ERROR_INACTIVE, "SESSION_REVOKED");
  }

  if (payload.role === "admin") {
    const user = await User.findById(payload.userId).select("_id").lean();
    if (!user) throw new ServiceError(401, ERROR_CREDENTIALS, "SESSION_REVOKED");
  } else {
    if (!isPremiumPlan(tenant.plan)) {
      throw new ServiceError(403, ERROR_PREMIUM, "SESSION_REVOKED");
    }
    const staff = (await StaffUser.findOne({ _id: payload.userId, tenantId: tenant._id })
      .select("active name role")
      .lean()) as IStaffUserLean | null;
    if (!staff || !staff.active) {
      throw new ServiceError(401, ERROR_CREDENTIALS, "SESSION_REVOKED");
    }
  }

  return tenantView(tenant);
}
