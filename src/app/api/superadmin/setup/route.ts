import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { consumeAttempt } from "@/server/services/rateLimit";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

// POST /api/superadmin/setup
// Protected by x-setup-secret header matching SUPERADMIN_SETUP_SECRET env var.
// Creates the first superadmin user. Idempotent.
// Comparación en tiempo constante (con hash para igualar largos): un `!==` deja medir cuántos
// caracteres coinciden.
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-setup-secret") ?? "";
  const expected = process.env.SUPERADMIN_SETUP_SECRET;

  // Sin la variable la ruta queda cerrada del todo. Con ella, 5 intentos por hora por IP.
  if (!expected) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await consumeAttempt(`superadmin-setup:${getIp(request)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }
  if (!sameSecret(secret, expected)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const email = (body.email as string)?.toLowerCase().trim();
    const password = body.password as string;

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: "Email y contraseña (mín 8 chars) requeridos" }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== "superadmin") {
        return NextResponse.json({ error: "El email ya existe con otro rol" }, { status: 409 });
      }
      return NextResponse.json({ message: "Superadmin ya existe", email });
    }

    const hash = await bcrypt.hash(password, 12);
    await User.create({ email, password: hash, role: "superadmin" });

    return NextResponse.json({ ok: true, message: "Superadmin creado", email });
  } catch (error) {
    console.error("[POST /api/superadmin/setup]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
