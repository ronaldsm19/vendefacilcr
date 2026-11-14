import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { submitProof } from "@/server/services/mensualidad";

/**
 * Sube el comprobante de un mes (archivo + fecha, método, referencia y nota en un mismo formulario)
 * y lo deja esperando revisión. Va al almacén privado: lleva datos bancarios.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  const { id } = await params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se recibió el comprobante" }, { status: 400 });
  }
  try {
    return NextResponse.json(await submitProof(session, id, form), { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
