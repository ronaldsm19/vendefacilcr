import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSuperadminSession } from "@/lib/auth";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { Product } from "@/models/Product";
import { SiteSettings } from "@/models/SiteSettings";
import { Tenant } from "@/models/Tenant";

/** Extrae el path dentro del bucket a partir de una URL pública de Supabase */
function extractPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function isSupabaseUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/");
}

/** Ya tiene el nuevo formato vendefacilcr/{slug}/... */
function isAlreadyMigrated(path: string): boolean {
  return path.startsWith("vendefacilcr/");
}

/**
 * POST /api/superadmin/migrate-storage
 *
 * Migra imágenes de Supabase de la estructura plana anterior
 * ({folder}/{file}) a la nueva estructura por tenant
 * (vendefacilcr/{tenantSlug}/{folder}/{file}).
 *
 * Actualiza todos los URLs en MongoDB (Products, SiteSettings, Tenants).
 * Llama este endpoint UNA SOLA VEZ desde Postman, curl o el navegador.
 */
export async function POST(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const tenants = await Tenant.find({}).lean() as Array<{
    _id: string;
    slug: string;
    logoUrl?: string;
  }>;

  const report: Record<string, { copied: number; updated: number; errors: string[] }> = {};

  for (const tenant of tenants) {
    const tenantId = String(tenant._id);
    const slug     = tenant.slug;
    report[slug]   = { copied: 0, updated: 0, errors: [] };

    // ── 1. Recolectar todos los URLs del tenant ────────────────────
    const urlSet = new Set<string>();

    // Tenant logoUrl
    if (tenant.logoUrl && isSupabaseUrl(tenant.logoUrl)) urlSet.add(tenant.logoUrl);

    // Products
    const products = await Product.find({ tenantId }).lean() as Array<{
      _id: string;
      image?: string;
      images?: string[];
    }>;
    for (const p of products) {
      if (p.image && isSupabaseUrl(p.image)) urlSet.add(p.image);
      for (const img of p.images ?? []) {
        if (isSupabaseUrl(img)) urlSet.add(img);
      }
    }

    // SiteSettings
    const settings = await SiteSettings.findOne({ tenantId }).lean() as {
      about?: { images?: string[] };
    } | null;
    for (const img of settings?.about?.images ?? []) {
      if (isSupabaseUrl(img)) urlSet.add(img);
    }

    // ── 2. Copiar cada archivo al nuevo path ──────────────────────
    const urlMap: Record<string, string> = {};

    for (const url of urlSet) {
      const oldPath = extractPath(url);
      if (!oldPath) continue;
      if (isAlreadyMigrated(oldPath)) {
        // Ya está en el formato nuevo — solo mapear a sí mismo
        urlMap[url] = url;
        continue;
      }

      const newPath = `vendefacilcr/${slug}/${oldPath}`;

      const { error: copyError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .copy(oldPath, newPath);

      if (copyError) {
        report[slug].errors.push(`copy ${oldPath}: ${copyError.message}`);
        continue;
      }

      const { data } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(newPath);

      urlMap[url] = data.publicUrl;
      report[slug].copied++;
    }

    if (Object.keys(urlMap).length === 0) continue;

    // ── 3. Actualizar MongoDB ──────────────────────────────────────

    // Tenant logoUrl
    if (tenant.logoUrl && urlMap[tenant.logoUrl]) {
      await Tenant.findByIdAndUpdate(tenantId, { logoUrl: urlMap[tenant.logoUrl] });
      report[slug].updated++;
    }

    // Products
    for (const p of products) {
      const updates: Record<string, unknown> = {};
      if (p.image && urlMap[p.image]) updates.image = urlMap[p.image];
      if (p.images?.some((img) => urlMap[img])) {
        updates.images = p.images.map((img) => urlMap[img] ?? img);
      }
      if (Object.keys(updates).length > 0) {
        await Product.findByIdAndUpdate(p._id, updates);
        report[slug].updated++;
      }
    }

    // SiteSettings
    if (settings?.about?.images?.some((img) => urlMap[img])) {
      const newImages = settings.about!.images!.map((img) => urlMap[img] ?? img);
      await SiteSettings.findOneAndUpdate({ tenantId }, { "about.images": newImages });
      report[slug].updated++;
    }

    // ── 4. Eliminar archivos viejos ───────────────────────────────
    const oldPaths = Object.keys(urlMap)
      .map(extractPath)
      .filter((p): p is string => !!p && !isAlreadyMigrated(p));

    if (oldPaths.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove(oldPaths);
      if (removeError) {
        report[slug].errors.push(`remove old files: ${removeError.message}`);
      }
    }
  }

  return NextResponse.json({ ok: true, report });
}
