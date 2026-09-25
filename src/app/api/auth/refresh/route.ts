import { NextRequest, NextResponse } from "next/server";
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS, type AdminPayload } from "@/lib/auth";
import { rotateRefreshToken } from "@/server/services/refreshTokens";
import { revalidateSession } from "@/server/services/auth";
import { ServiceError } from "@/server/errors";
import { StaffUser } from "@/models/StaffUser";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { connectToDatabase } from "@/lib/mongodb";

// Renueva el par de tokens. Acá es donde se hace efectiva una desactivación: el token de
// acceso ya emitido no se puede retirar, pero dura una hora y el refresco revalida contra la
// base antes de entregar uno nuevo.

interface StaffLean { _id: { toString(): string }; name: string; role: AdminPayload["role"]; active: boolean }
interface UserLean  { _id: { toString(): string }; email: string }
interface TenantLean { _id: { toString(): string }; slug: string; ticketConfig?: { ownerName?: string } }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { stored, refreshToken } = await rotateRefreshToken(body.refreshToken);

    await connectToDatabase();
    const tenantDoc = await Tenant.findById(stored.tenantId)
      .select("_id slug ticketConfig").lean() as TenantLean | null;
    if (!tenantDoc) throw new ServiceError(401, "Sesión no válida", "SESSION_REVOKED");

    // El payload se reconstruye desde la base, no desde el token viejo: si le cambiaron el rol
    // o el nombre, la app recibe el dato nuevo en el siguiente refresco.
    let payload: AdminPayload;
    if (stored.userType === "admin") {
      const user = await User.findById(stored.userId).select("_id email").lean() as UserLean | null;
      if (!user) throw new ServiceError(401, "Sesión no válida", "SESSION_REVOKED");
      payload = {
        role: "admin",
        tenantId: tenantDoc._id.toString(),
        tenantSlug: tenantDoc.slug,
        userId: user._id.toString(),
        name: tenantDoc.ticketConfig?.ownerName?.trim() || "Administrador",
        email: user.email,
      };
    } else {
      const staff = await StaffUser.findOne({ _id: stored.userId, tenantId: tenantDoc._id })
        .select("_id name role active").lean() as StaffLean | null;
      if (!staff || !staff.active) throw new ServiceError(401, "Sesión no válida", "SESSION_REVOKED");
      payload = {
        role: staff.role,
        tenantId: tenantDoc._id.toString(),
        tenantSlug: tenantDoc.slug,
        userId: staff._id.toString(),
        name: staff.name,
      };
    }

    const tenant = await revalidateSession(payload);
    const accessToken = await signAccessToken(payload);

    return NextResponse.json({
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      user: {
        role: payload.role,
        name: payload.name,
        userId: payload.userId,
        ...(payload.email ? { email: payload.email } : {}),
      },
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        isPremium: tenant.isPremium,
        theme: tenant.theme,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }
    console.error("[POST /api/auth/refresh]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
