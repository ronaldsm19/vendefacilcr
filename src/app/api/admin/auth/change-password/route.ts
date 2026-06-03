import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { getSession, COOKIE_NAME } from "@/lib/auth";
import { sendMail, passwordChangedEmailHtml } from "@/lib/email";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Contraseña actual y nueva son requeridas" }, { status: 400 });
  }
  if (String(newPassword).length < 8) {
    return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  await connectToDatabase();

  const user = await User.findOne({ email: session.email, tenantId: session.tenantId });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  await Tenant.updateOne({ _id: session.tenantId }, { passwordChanged: true });

  const tenant = await Tenant.findById(session.tenantId).select("name").lean() as { name?: string } | null;

  // Confirmación por correo — no bloquea (sendMail nunca lanza)
  await sendMail({
    to: user.email,
    subject: "Tu contraseña fue actualizada",
    html: passwordChangedEmailHtml({ name: tenant?.name ?? user.email }),
  });

  // Cerrar la sesión: borrar la cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
