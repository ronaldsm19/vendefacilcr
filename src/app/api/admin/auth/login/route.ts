import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { StaffUser, USERNAME_RE, PIN_RE } from "@/models/StaffUser";
import { AccessLog } from "@/models/AccessLog";
import { signJwt, COOKIE_NAME } from "@/lib/auth";
import { isPremiumPlan, homePathFor, ERROR_PREMIUM, type Role } from "@/lib/permissions";

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
  _id: { toString(): string };
  email: string;
  password: string;
  role: string;
  tenantId?: { toString(): string };
}

interface ITenantLean {
  _id: { toString(): string };
  slug: string;
  status: string;
  plan?: string;
  passwordChanged?: boolean;
  ticketConfig?: { ownerName?: string };
}

interface IStaffUserLean {
  _id: { toString(): string };
  name: string;
  username: string;
  pinHash: string;
  role: Role;
  active: boolean;
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
    const body = await request.json();
    const login = String(body.login ?? body.email ?? "").trim();
    const password = body.password;
    const tenantSlug: string | undefined = body.tenantSlug;

    if (!login || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ua = request.headers.get("user-agent") ?? "";

    // ── Rama ADMIN: correo + contraseña ──────────────────────────
    if (login.includes("@")) {
      const email = login.toLowerCase();

      const user = await User.findOne({ email }).lean() as IUserLean | null;

      if (!user) {
        recordFail(ip);
        if (tenantSlug) {
          Tenant.findOne({ slug: tenantSlug }).lean().then((t) => {
            if (t) AccessLog.create({ tenantId: (t as ITenantLean)._id.toString(), tenantSlug, userEmail: email, ip, userAgent: ua, success: false, event: "login" }).catch(() => {});
          }).catch(() => {});
        }
        await new Promise((r) => setTimeout(r, 500));
        return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        recordFail(ip);
        if (user.tenantId) {
          Tenant.findById(user.tenantId).lean().then((t) => {
            if (t) AccessLog.create({ tenantId: (t as ITenantLean)._id.toString(), tenantSlug: (t as ITenantLean).slug, userEmail: user.email, ip, userAgent: ua, success: false, event: "login" }).catch(() => {});
          }).catch(() => {});
        }
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
        AccessLog.create({ tenantId: tenant._id.toString(), tenantSlug: tenant.slug, userEmail: user.email, ip, userAgent: ua, success: false, event: "login" }).catch(() => {});
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
        userAgent:  ua,
        success:    true,
        event:      "login",
      }).catch(() => {});

      const name = tenant.ticketConfig?.ownerName?.trim() || "Administrador";

      const token = await signJwt({
        role: "admin",
        tenantId: tenant._id.toString(),
        tenantSlug: tenant.slug,
        userId: user._id.toString(),
        name,
        email: user.email,
      });

      const response = NextResponse.json({
        ok: true,
        role: "admin",
        name,
        email: user.email,
        tenantSlug: tenant.slug,
        passwordChanged: tenant.passwordChanged ?? false,
        redirectTo: `/${tenant.slug}/admin`,
      });
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 24 horas
      });

      return response;
    }

    // ── Rama STAFF: usuario + PIN ─────────────────────────────────
    if (!tenantSlug) {
      return NextResponse.json({ error: "Tenant requerido" }, { status: 400 });
    }

    const username = login.toLowerCase();
    const pin = String(password);

    if (!USERNAME_RE.test(username) || !PIN_RE.test(pin)) {
      recordFail(ip);
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug }).select("_id slug status plan").lean() as ITenantLean | null;
    if (!tenant) {
      recordFail(ip);
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const key = `${tenant._id}:${username}`;
    if (isBlocked(key)) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos para este usuario. Intentá de nuevo en 15 minutos." },
        { status: 429 }
      );
    }

    if (tenant.status !== "active") {
      return NextResponse.json({ error: "Tu cuenta está inactiva. Contactá a VendeFácil." }, { status: 403 });
    }

    if (!isPremiumPlan(tenant.plan)) {
      return NextResponse.json({ error: ERROR_PREMIUM }, { status: 403 });
    }

    const staff = await StaffUser.findOne({ tenantId: tenant._id, username }).lean() as IStaffUserLean | null;

    if (!staff || !staff.active || !(await bcrypt.compare(pin, staff.pinHash))) {
      recordFail(ip);
      recordFail(key);
      AccessLog.create({ tenantId: tenant._id.toString(), tenantSlug: tenant.slug, userEmail: username, ip, userAgent: ua, success: false, event: "login" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    clearAttempts(ip);
    clearAttempts(key);

    AccessLog.create({
      tenantId:   tenant._id.toString(),
      tenantSlug: tenant.slug,
      userEmail:  username,
      ip,
      userAgent:  ua,
      success:    true,
      event:      "login",
    }).catch(() => {});

    const token = await signJwt({
      role: staff.role,
      tenantId: tenant._id.toString(),
      tenantSlug: tenant.slug,
      userId: String(staff._id),
      name: staff.name,
    });

    const redirectTo = homePathFor(staff.role, `/${tenant.slug}/admin`);

    const response = NextResponse.json({
      ok: true,
      role: staff.role,
      name: staff.name,
      tenantSlug: tenant.slug,
      redirectTo,
    });
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
