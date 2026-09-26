import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import {
  PRIVATE_BUCKET,
  SIGNED_URL_DAYS,
  ensurePrivateBucket,
  signPrivateUrl,
  supabaseAdmin,
} from "@/lib/supabase";

/**
 * Subida de los archivos de la planilla: el pantallazo del SINPE y el comprobante en PDF.
 *
 * Va aparte de /api/admin/upload porque aquel guarda en el bucket público, donde cualquiera
 * con la dirección abre el archivo. Acá no: el archivo no tiene dirección pública y lo que se
 * devuelve es su ruta interna más un enlace firmado que vence a los siete días.
 *
 * La ruta es lo que se guarda en el pago; el enlace se vuelve a firmar cada vez que hace
 * falta, así que vencer no rompe nada — solo impide que un enlace reenviado sirva para siempre.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes (JPG, PNG, WEBP, GIF) o PDF" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "El archivo no puede superar 5 MB" }, { status: 400 });
    }

    await ensurePrivateBucket();

    const ext = EXTENSIONS[file.type] ?? "bin";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    // Siempre bajo el slug del negocio: la ruta sola no deja llegar a los archivos de otro.
    const path = `${session.tenantSlug}/planilla/${name}`;

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (error) {
      console.error("[payroll upload] Supabase:", error);
      return NextResponse.json({ error: "No se pudo guardar el archivo" }, { status: 500 });
    }

    return NextResponse.json({ path, url: await signPrivateUrl(path), expiresInDays: SIGNED_URL_DAYS });
  } catch (error) {
    console.error("[POST /api/admin/payroll/upload]", error);
    return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 500 });
  }
}
