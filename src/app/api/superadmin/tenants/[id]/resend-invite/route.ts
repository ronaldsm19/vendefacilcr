import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { getSuperadminSession } from "@/lib/auth";
import { sendMail, welcomeEmailHtml } from "@/lib/email";

/**
 * Reenvía el correo de invitación a un tenant. Como la contraseña se guarda
 * hasheada y no se puede recuperar, se genera una contraseña temporal NUEVA,
 * se actualiza en el usuario admin y se reinicia passwordChanged a false.
 * La contraseña anterior deja de funcionar.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const tenant = await Tenant.findById(id).lean() as
    | { _id: unknown; slug: string; name: string }
    | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  const user = await User.findOne({ tenantId: tenant._id, role: "admin" });
  if (!user) {
    return NextResponse.json({ error: "Este tenant no tiene un usuario admin asociado" }, { status: 404 });
  }

  // Nueva contraseña temporal (mismo formato que la creación)
  const tempPassword = Math.random().toString(36).slice(2, 10) + "A1!";
  user.password = await bcrypt.hash(tempPassword, 12);
  await user.save();

  // Vuelve a estado "pendiente de cambio"
  await Tenant.updateOne({ _id: tenant._id }, { passwordChanged: false });

  const result = await sendMail({
    to: user.email,
    subject: "Tus accesos a VendeFácil (reenvío)",
    html: welcomeEmailHtml({ name: tenant.name, slug: tenant.slug, email: user.email, tempPassword }),
  });

  // Se devuelve la contraseña temporal para que el superadmin pueda copiarla
  // manualmente aunque el envío de correo falle.
  return NextResponse.json({
    ok: true,
    email: user.email,
    tempPassword,
    emailSent: result.ok,
  });
}
