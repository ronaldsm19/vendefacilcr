import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { revalidateSession } from "@/server/services/auth";
import { ServiceError } from "@/server/errors";

// Quién soy, para la app. Revalida contra la base igual que /api/admin/auth/me, así una
// desactivación saca a la persona en la siguiente navegación y no solo al vencer el token.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const tenant = await revalidateSession(session);
    return NextResponse.json({
      user: {
        role: session.role,
        name: session.name,
        userId: session.userId,
        ...(session.email ? { email: session.email } : {}),
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
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
