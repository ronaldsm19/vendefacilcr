import { NextRequest, NextResponse } from "next/server";
import { signJwt, setSessionCookie } from "@/lib/auth";
import { authenticate } from "@/server/services/auth";
import { ServiceError } from "@/server/errors";

// Login de la WEB: deja la sesión en la cookie httpOnly.
// La app móvil usa POST /api/auth/token, que comparte exactamente esta misma validación
// através del servicio `authenticate`.

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = await authenticate({
      login: String(body.login ?? body.email ?? ""),
      password: body.password,
      tenantSlug: body.tenantSlug,
      ip: getIp(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });

    const token = await signJwt(result.payload);

    const response = NextResponse.json({
      ok: true,
      role: result.payload.role,
      name: result.payload.name,
      ...(result.payload.email ? { email: result.payload.email } : {}),
      tenantSlug: result.tenant.slug,
      ...(result.payload.role === "admin"
        ? { passwordChanged: result.tenant.passwordChanged }
        : {}),
      redirectTo: result.redirectTo,
    });

    return setSessionCookie(response, token);
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/auth/login]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
