import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import type { Role, Feature } from "@/lib/permissions";
import { can, hasRole, ERROR_FORBIDDEN } from "@/lib/permissions";

// Con la clave de respaldo cualquiera puede fabricar sesiones (de un negocio o del superadmin):
// solo se permite fuera de producción. En producción, sin JWT_SECRET la compilación falla y Vercel
// conserva el despliegue anterior en vez de publicar uno inseguro.
const DEV_FALLBACK_SECRET = "fallback-secret-change-in-production";
const rawSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!rawSecret || rawSecret === DEV_FALLBACK_SECRET)) {
  throw new Error("JWT_SECRET no está configurado: no se puede firmar sesiones en producción.");
}
const JWT_SECRET = new TextEncoder().encode(rawSecret || DEV_FALLBACK_SECRET);

export interface AdminPayload {
  role: Role;               // "admin" | "cajero" | "mesero"
  tenantId: string;
  tenantSlug: string;
  userId: string;           // User._id (admin) o StaffUser._id (staff), como string
  name: string;             // admin: ticketConfig.ownerName || "Administrador"; staff: StaffUser.name
  email?: string;           // solo admin
}

/**
 * Cuánto vive la sesión del panel sin que nadie la toque. Se renueva sola mientras el panel está
 * abierto (ver setSessionCookie), así que esto es el tiempo que aguanta una computadora apagada o
 * una pestaña cerrada, no el turno de trabajo.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function signJwt(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    // La misma constante que la cookie: si se separaran, el token moriría antes que la cookie y
    // la pantalla seguiría creyéndose con sesión.
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(JWT_SECRET);
}

/** Opciones de la cookie de sesión, en un solo lugar para que login, renovación y cierre coincidan. */
function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, "", sessionCookieOptions(0));
  return response;
}

export async function verifyJwt(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as unknown as Partial<AdminPayload>;
    if (!p.tenantId || !p.tenantSlug || !p.userId || !p.name) return null;
    if (p.role !== "admin" && p.role !== "cajero" && p.role !== "mesero") return null;
    return p as AdminPayload;
  } catch {
    return null;
  }
}

/**
 * Sesión de la petición. Acepta DOS credenciales:
 *
 *  1. `Authorization: Bearer <jwt>` — lo usa la app móvil (React Native), que no maneja
 *     cookies de forma confiable en iOS y Android.
 *  2. La cookie httpOnly `dulce_admin_session` — lo usa la web, sin cambios.
 *
 * Si viene el encabezado, manda el encabezado: un token inválido o vencido devuelve null y
 * NO se cae a la cookie. Caer a la cookie convertiría un token malo en una invitación a
 * probar otra credencial, y haría que la app pareciera funcionar en un navegador con sesión
 * abierta mientras falla en el teléfono.
 */
export async function getSessionPayload(
  request: NextRequest,
  { anyTenant = false }: { anyTenant?: boolean } = {},
): Promise<AdminPayload | null> {
  const bearer = bearerToken(request);
  const token = bearer !== null ? bearer : request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyJwt(token);
  if (!payload || anyTenant) return payload;
  // La cookie es una sola para todo el sitio: con la sesión de un negocio abierta, el panel de otro
  // (otra pestaña, otra dirección) no puede leer ni guardar nada con ella.
  const expected = expectedTenantSlug(request);
  return expected && expected !== payload.tenantSlug.toLowerCase() ? null : payload;
}

/**
 * Encabezado con el negocio que el panel tiene abierto (lo pone src/lib/sessionWatch.ts en cada
 * pedido a /api/admin desde /<negocio>/admin). La app móvil no lo manda.
 */
export const TENANT_HEADER = "x-ennea-tenant";

/** El negocio que dice estar mirando el panel, o null si el pedido no lo indica. */
export function expectedTenantSlug(request: NextRequest): string | null {
  const value = request.headers.get(TENANT_HEADER)?.trim().toLowerCase();
  return value ? value : null;
}

/**
 * La sesión del panel, solo si el negocio sigue activo. Así una suspensión corta también a quien
 * ya tenía el panel abierto (o la app con un token vigente), en vez de esperar a que venza el token.
 * Las pocas rutas que necesitan explicar POR QUÉ no hay sesión (los "quién soy") usan
 * getSessionPayload y revisan el estado ellas mismas.
 */
export async function getSession(
  request: NextRequest
): Promise<AdminPayload | null> {
  const payload = await getSessionPayload(request);
  if (!payload) return null;
  // Import diferido: este archivo también lo usa el proxy, que no necesita la base.
  const { isTenantActive } = await import("@/server/services/tenantAccess");
  return (await isTenantActive(payload.tenantId)) ? payload : null;
}

/** El token del encabezado Authorization, o null si no viene el encabezado. */
export function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : "";
}

export const COOKIE_NAME = "dulce_admin_session";

/** Vida del token de acceso que consume la app móvil. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hora

/** Firma un token de acceso corto para la app. La web sigue usando signJwt (24 h). */
export async function signAccessToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(JWT_SECRET);
}

export function forbidden(message: string = ERROR_FORBIDDEN): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** null si el rol de la sesión tiene la feature; si no, respuesta 403 lista para retornar. */
export function requireFeature(session: AdminPayload, feature: Feature): NextResponse | null {
  return can(session, feature) ? null : forbidden();
}

/** null si session.role está en roles; si no, 403. */
export function requireRole(session: AdminPayload, ...roles: Role[]): NextResponse | null {
  return hasRole(session, ...roles) ? null : forbidden();
}

// ── Superadmin Auth ────────────────────────────────────────────

export interface SuperadminPayload {
  email: string;
  role: "superadmin";
}

export const SUPERADMIN_COOKIE_NAME = "vf_superadmin_session";

export async function signSuperadminJwt(payload: SuperadminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(JWT_SECRET);
}

export async function verifySuperadminJwt(token: string): Promise<SuperadminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as unknown as SuperadminPayload;
    if (p.role !== "superadmin") return null;
    return p;
  } catch {
    return null;
  }
}

export async function getSuperadminSession(
  request: NextRequest
): Promise<SuperadminPayload | null> {
  const token = request.cookies.get(SUPERADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySuperadminJwt(token);
}
