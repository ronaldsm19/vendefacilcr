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

export async function getSession(
  request: NextRequest
): Promise<AdminPayload | null> {
  const token = request.cookies.get("dulce_admin_session")?.value;
  if (!token) return null;
  return verifyJwt(token);
}

export const COOKIE_NAME = "dulce_admin_session";

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
