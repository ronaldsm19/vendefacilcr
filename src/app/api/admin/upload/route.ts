import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

/** Extrae el path dentro del bucket a partir de una URL pública de Supabase */
function extractStoragePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes (JPG, PNG, WEBP, GIF)" },
        { status: 400 }
      );
    }

    // Validar tamaño (máx 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen no puede superar 5 MB" },
        { status: 400 }
      );
    }

    // Carpeta destino (solo valores permitidos)
    const folderParam = request.nextUrl.searchParams.get("folder") ?? "products";
    const folder = ["products", "billing", "about"].includes(folderParam) ? folderParam : "products";

    // Generar nombre único
    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `vendefacilcr/${session.tenantSlug}/${folder}/${fileName}`;

    // Convertir File a ArrayBuffer para Supabase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Subir nueva imagen
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload] Supabase error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Obtener URL pública
    const { data } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    // Eliminar imagen anterior si se proporcionó
    const oldImageUrl = formData.get("oldImageUrl") as string | null;
    if (oldImageUrl) {
      const oldPath = extractStoragePath(oldImageUrl);
      if (oldPath) {
        supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .remove([oldPath])
          .catch((err) => console.error("[upload] Error eliminando imagen anterior:", err));
      }
    }

    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("[POST /api/admin/upload]", error);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

    const path = extractStoragePath(url);
    if (!path) return NextResponse.json({ error: "URL inválida" }, { status: 400 });

    const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([path]);
    if (error) {
      console.error("[upload DELETE] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/upload]", error);
    return NextResponse.json({ error: "Error al eliminar la imagen" }, { status: 500 });
  }
}
