import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);

export interface AdminPayload {
  email: string;
  role: "admin";
  tenantId: string;
  tenantSlug: string;
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
    return payload as unknown as AdminPayload;
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
