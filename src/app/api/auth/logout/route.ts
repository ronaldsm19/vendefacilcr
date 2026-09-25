import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/server/services/refreshTokens";

// Cerrar sesión desde la app. Responde 200 aunque el token ya no exista o nunca haya existido:
// decir "ese token no estaba" solo le serviría a alguien probando tokens ajenos.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    await revokeRefreshToken(body.refreshToken);
  } catch (error) {
    console.error("[POST /api/auth/logout]", error);
  }
  return NextResponse.json({ ok: true });
}
