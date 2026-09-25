import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import type { Role, Feature } from "@/lib/permissions";
import { can, hasRole, ERROR_FORBIDDEN } from "@/lib/permissions";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);

export interface AdminPayload {
  role: Role;               // "admin" | "cajero" | "mesero"
  tenantId: string;
  tenantSlug: string;
  userId: string;           // User._id (admin) o StaffUser._id (staff), como string
  name: string;             // admin: ticketConfig.ownerName || "Administrador"; staff: StaffUser.name
  email?: string;           // solo admin
}

export async function signJwt(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
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
export async function getSession(
  request: NextRequest
): Promise<AdminPayload | null> {
  const bearer = bearerToken(request);
  if (bearer !== null) return verifyJwt(bearer);

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJwt(token);
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
