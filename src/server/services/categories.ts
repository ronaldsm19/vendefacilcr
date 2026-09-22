import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/models/Category";
import { ServiceError } from "@/server/errors";
import type { CategoryOrderEntry } from "@/lib/categories";

const DEFAULTS = ["Gelatina Mosaico", "Apretado Gourmet", "Edición Especial"];

interface CategoryLean {
  _id: { toString(): string };
  label: string;
  order: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Categorías ("familias") del negocio en su orden configurado. Si no tiene ninguna, siembra las de
 * fábrica. Mientras nadie haya tocado el orden (todas en 0, el default del schema) les asigna un
 * correlativo siguiendo el alfabético que ya tenían, para que nadie note un cambio hasta que el
 * admin arrastre algo; una vez reordenadas de verdad, esa migración deja de aplicar.
 */
export async function listCategories(tenantId: string) {
  await connectToDatabase();
  let cats = await Category.find({ tenantId }).sort({ order: 1, label: 1 }).lean<CategoryLean[]>();
  if (cats.length === 0) {
    await Category.insertMany(DEFAULTS.map((label) => ({ label, tenantId })));
    cats = await Category.find({ tenantId }).sort({ order: 1, label: 1 }).lean<CategoryLean[]>();
  }

  if (cats.length > 0 && cats.every((c) => !c.order)) {
    const alphabetical = [...cats].sort((a, b) => a.label.localeCompare(b.label));
    await Category.bulkWrite(
      alphabetical.map((c, index) => ({
        updateOne: { filter: { _id: c._id, tenantId }, update: { $set: { order: index } } },
      }))
    );
    cats = alphabetical.map((c, index) => ({ ...c, order: index }));
  }
  return cats;
}

/** Solo lectura, sin sembrar ni migrar: el orden que usa la tienda pública. */
export async function getCategoryOrder(tenantId: string): Promise<CategoryOrderEntry[]> {
  await connectToDatabase();
  const cats = await Category.find({ tenantId }).select("label order").lean<CategoryLean[]>();
  return cats.map((c) => ({ label: c.label, order: c.order ?? 0 }));
}

/** Crea la categoría al final del orden; si ya existe una con el mismo nombre (sin importar mayúsculas), devuelve esa. */
export async function createCategory(tenantId: string, rawLabel: string) {
  const label = rawLabel.trim();
  if (!label) throw new ServiceError(400, "Label requerido");
  await connectToDatabase();

  const existing = await Category.findOne({
    tenantId,
    label: { $regex: `^${escapeRegex(label)}$`, $options: "i" },
  }).lean<CategoryLean | null>();
  if (existing) return { category: existing, created: false };

  const last = await Category.findOne({ tenantId }).sort({ order: -1 }).select("order").lean<{ order?: number } | null>();
  const category = await Category.create({ tenantId, label, order: (last?.order ?? -1) + 1 });
  return { category: category.toObject() as CategoryLean, created: true };
}

/** Borra la categoría solo si es de este negocio. Idempotente: borrar algo que no existe no es error. */
export async function deleteCategory(tenantId: string, id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) return;
  await connectToDatabase();
  await Category.deleteOne({ _id: id, tenantId });
}

/** Guarda el orden de TODAS las categorías del negocio de una vez, según la posición en `ids`. */
export async function reorderCategories(tenantId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) throw new ServiceError(400, "ids inválido");
  await connectToDatabase();

  const existing = await Category.find({ tenantId }).select("_id").lean<{ _id: { toString(): string } }[]>();
  const existingIds = new Set(existing.map((c) => c._id.toString()));
  const incomingIds = new Set(ids);

  const allBelongToTenant = ids.every((id) => existingIds.has(id));
  const sameSize = incomingIds.size === ids.length && incomingIds.size === existingIds.size;
  if (!allBelongToTenant || !sameSize) {
    throw new ServiceError(
      400,
      "La lista no coincide con las categorías de este negocio (falta alguna, sobra alguna, o hay repetidas)"
    );
  }

  await Category.bulkWrite(
    ids.map((id, index) => ({
      updateOne: { filter: { _id: id, tenantId }, update: { $set: { order: index } } },
    }))
  );
}
