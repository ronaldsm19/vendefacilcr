import { NextRequest, NextResponse } from "next/server";
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from "@/lib/auth";
import { authenticate } from "@/server/services/auth";
import { issueRefreshToken } from "@/server/services/refreshTokens";
import { ServiceError } from "@/server/errors";

// Login de la APP MÓVIL. Misma validación que la web (servicio `authenticate`), pero devuelve
// tokens en el cuerpo en vez de una cookie: React Native no maneja cookies de forma confiable
// en iOS y Android.
//
// No setea ninguna cookie y no habilita CORS: una app nativa no lo necesita, y abrirlo
// expondría la API a cualquier sitio web.

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await authenticate({
      login: String(body.login ?? ""),
      password: body.password,
      tenantSlug: body.tenantSlug,
      ip: getIp(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(result.payload),
      issueRefreshToken({
        payload: result.payload,
        userType: result.userType,
        deviceName: body.deviceName,
        platform: body.platform,
      }),
    ]);

    // El tema viaja en esta misma respuesta para que la app se pinte con los colores del
    // restaurante sin una segunda llamada.
    return NextResponse.json({
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      user: {
        role: result.payload.role,
        name: result.payload.name,
        userId: result.payload.userId,
        ...(result.payload.email ? { email: result.payload.email } : {}),
      },
      tenant: {
        slug: result.tenant.slug,
        name: result.tenant.name,
        plan: result.tenant.plan,
        isPremium: result.tenant.isPremium,
        theme: result.tenant.theme,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }
    console.error("[POST /api/auth/token]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
