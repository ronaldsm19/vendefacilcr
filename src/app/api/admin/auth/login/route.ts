import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { AccessLog } from "@/models/AccessLog";
import { signJwt, COOKIE_NAME } from "@/lib/auth";

// ── In-memory rate limiter ──────────────────────────────────────
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function isBlocked(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) { attempts.delete(ip); return false; }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFail(ip: string) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count++;
  }
}

function clearAttempts(ip: string) {
  attempts.delete(ip);
}
// ───────────────────────────────────────────────────────────────

interface IUserLean {
  email: string;
  password: string;
  role: string;
  tenantId?: { toString(): string };
}

interface ITenantLean {
  _id: { toString(): string };
  slug: string;
  status: string;
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);

  if (isBlocked(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos." },
      { status: 429 }
    );
  }

  try {
    const { email, password, tenantSlug } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Correo y contraseña son requeridos" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email: email.toLowerCase().trim() }).lean() as IUserLean | null;

    if (!user) {
      recordFail(ip);
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      recordFail(ip);
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado. Contactá al administrador." }, { status: 403 });
    }

    const tenant = await Tenant.findById(user.tenantId).lean() as ITenantLean | null;
    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 403 });
    }

    if (tenant.status !== "active") {
      return NextResponse.json({ error: "Tu cuenta está inactiva. Contactá a VendeFácil." }, { status: 403 });
    }

    // Validate that the URL tenant matches the user's tenant
    if (tenantSlug && tenantSlug !== tenant.slug) {
      recordFail(ip);
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    clearAttempts(ip);

    // Record successful login — non-blocking
    AccessLog.create({
      tenantId:   tenant._id.toString(),
      tenantSlug: tenant.slug,
      userEmail:  user.email,
      ip,
      userAgent:  request.headers.get("user-agent") ?? "",
      success:    true,
    }).catch(() => {});

    const token = await signJwt({
      email: user.email,
      role: "admin",
      tenantId: tenant._id.toString(),
      tenantSlug: tenant.slug,
    });

    const response = NextResponse.json({ ok: true, email: user.email, tenantSlug: tenant.slug });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 horas
    });

    return response;
  } catch (error) {
    console.error("[POST /api/admin/auth/login]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
