import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { signSuperadminJwt, SUPERADMIN_COOKIE_NAME } from "@/lib/auth";
import { consumeAttempt, clearAttempts } from "@/server/services/rateLimit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

interface IUserLean { email: string; password: string; role: string; }

export async function POST(request: NextRequest) {
  const rateKey = `superadmin-ip:${getIp(request)}`;

  try {
    await connectToDatabase();
    if (!(await consumeAttempt(rateKey, MAX_ATTEMPTS, WINDOW_MS))) {
      return NextResponse.json({ error: "Demasiados intentos. Intenta en 15 min." }, { status: 429 });
    }

    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Correo y contraseña requeridos" }, { status: 400 });

    const user = await User.findOne({ email: email.toLowerCase().trim(), role: "superadmin" }).lean() as IUserLean | null;

    if (!user) {
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    await clearAttempts(rateKey);
    const token = await signSuperadminJwt({ email: user.email, role: "superadmin" });

    const response = NextResponse.json({ ok: true, email: user.email });
    response.cookies.set(SUPERADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 horas
    });
    return response;
  } catch (error) {
    console.error("[POST /api/superadmin/auth/login]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
