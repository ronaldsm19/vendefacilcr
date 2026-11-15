import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { ServiceError } from "@/server/errors";
import {
  MAX_SECTIONS, MAX_SECTION_NAME, OTHER_SECTION_ID, categorySectionMap, isSectionId, readSections,
  sectionOfCategory, totalsBySection, type BusinessSection, type SectionTotal,
} from "@/lib/sections";

/** Secciones del negocio en su orden. Vacío si el negocio no usa secciones. */
export async function listSections(tenantId: string): Promise<BusinessSection[]> {
  await connectToDatabase();
  const tenant = await Tenant.findById(tenantId).select("sections").lean<{ sections?: unknown } | null>();
  return readSections(tenant?.sections);
}

/**
 * Reemplaza la lista completa de secciones (nombres y orden). Las que traen un `id` que ya existe
 * conservan su id —así sus categorías siguen asignadas—; las nuevas reciben uno. Las categorías
 * que apuntaban a una sección que se quitó quedan sin sección.
 */
export async function saveSections(
  tenantId: string,
  incoming: unknown
): Promise<BusinessSection[]> {
  if (!Array.isArray(incoming)) throw new ServiceError(400, "sections inválido");
  if (incoming.length > MAX_SECTIONS) {
    throw new ServiceError(400, `Podés tener hasta ${MAX_SECTIONS} secciones`);
  }

  const current = await listSections(tenantId);
  const currentIds = new Set(current.map((s) => s.id));
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const next: { _id: mongoose.Types.ObjectId; name: string }[] = [];

  for (const raw of incoming) {
    const rec = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) throw new ServiceError(400, "Cada sección necesita un nombre");
    if (name.length > MAX_SECTION_NAME) {
      throw new ServiceError(400, `El nombre de una sección puede tener hasta ${MAX_SECTION_NAME} caracteres`);
    }
    const key = name.toLocaleLowerCase("es");
    if (key === "otros") throw new ServiceError(400, "\"Otros\" está reservado para lo que no tiene sección");
    if (seenNames.has(key)) throw new ServiceError(400, `La sección "${name}" está repetida`);
    seenNames.add(key);

    const id = typeof rec.id === "string" && isSectionId(rec.id) && currentIds.has(rec.id) && !seenIds.has(rec.id)
      ? rec.id
      : new mongoose.Types.ObjectId().toString();
    seenIds.add(id);
    next.push({ _id: new mongoose.Types.ObjectId(id), name });
  }

  await Tenant.updateOne({ _id: tenantId }, { $set: { sections: next } });

  const removed = [...currentIds].filter((id) => !seenIds.has(id));
  if (removed.length > 0) {
    await Category.updateMany({ tenantId, sectionId: { $in: removed } }, { $set: { sectionId: "" } });
  }

  return next.map((s) => ({ id: s._id.toString(), name: s.name }));
}

/** Asigna una categoría a una sección ("" = sin sección). */
export async function setCategorySection(tenantId: string, categoryId: string, sectionId: unknown) {
  if (!mongoose.isValidObjectId(categoryId)) throw new ServiceError(404, "Categoría no encontrada");
  const value = typeof sectionId === "string" ? sectionId : "";
  if (value !== "") {
    const sections = await listSections(tenantId);
    if (!sections.some((s) => s.id === value)) throw new ServiceError(400, "Esa sección no existe");
  }
  await connectToDatabase();
  const res = await Category.updateOne({ _id: categoryId, tenantId }, { $set: { sectionId: value } });
  if (res.matchedCount === 0) throw new ServiceError(404, "Categoría no encontrada");
}

export interface ProductSectionResolver {
  sections: BusinessSection[];
  /** Sección de un producto vendido ("otros" si no tiene o si el producto ya no existe). */
  ofProduct(productId: string | null | undefined): string;
}

/**
 * Para reportes (finanzas, cierre): resuelve la sección de cada producto vendido según su
 * categoría ACTUAL. Si el negocio no tiene secciones devuelve null y el reporte no muestra nada.
 */
export async function productSectionResolver(tenantId: string): Promise<ProductSectionResolver | null> {
  const sections = await listSections(tenantId);
  if (sections.length === 0) return null;

  const [categories, products] = await Promise.all([
    Category.find({ tenantId }).select("label sectionId").lean<{ label: string; sectionId?: string }[]>(),
    Product.find({ tenantId }).select("_id category").lean<{ _id: { toString(): string }; category?: string }[]>(),
  ]);
  const catMap = categorySectionMap(sections, categories);
  const byProduct = new Map<string, string>();
  for (const p of products) byProduct.set(p._id.toString(), sectionOfCategory(catMap, p.category));

  return {
    sections,
    ofProduct: (productId) => (productId && byProduct.get(String(productId))) || OTHER_SECTION_ID,
  };
}

/**
 * Ventas por sección de un grupo de ventas del POS (el cierre del día). Suma las líneas, sin IVA,
 * servicio, propina ni envío. null si el negocio no tiene secciones.
 */
export async function sectionsSummaryFromSales(
  tenantId: string,
  sales: { items?: { productId?: string | null; lineTotal?: number; quantity?: number }[] }[]
): Promise<SectionTotal[] | null> {
  const resolver = await productSectionResolver(tenantId);
  if (!resolver) return null;
  const lines = sales.flatMap((s) =>
    (s.items ?? []).map((it) => ({
      sectionId: resolver.ofProduct(it.productId),
      revenue: it.lineTotal ?? 0,
      units: it.quantity ?? 0,
    }))
  );
  return totalsBySection(resolver.sections, lines);
}
