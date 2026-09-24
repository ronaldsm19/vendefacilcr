import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { MAX_EXTRA_NAME, normalizeExtras, type LineExtra } from "@/lib/pricing";

// Negocios ya migrados en este proceso: después de la primera lectura no se vuelve a consultar.
const migratedTenants = new Set<string>();

/**
 * Migración única e idempotente de `toppings` (nombres sueltos, obsoletos) a `extras` con precio.
 * Cada topping pasa a ser un extra de ₡0. Solo toca productos que todavía NO tienen el campo
 * `extras`, así que correrla dos veces no cambia nada y nunca pisa extras cargados a mano. Se
 * llama antes de leer productos (catálogo, tienda, POS, comandas); el campo `toppings` queda
 * intacto en la base, pero ninguna pantalla lo vuelve a leer.
 */
export async function ensureExtrasMigrated(tenantId: string): Promise<void> {
  const key = String(tenantId);
  if (migratedTenants.has(key) || !mongoose.isValidObjectId(key)) return;
  await connectToDatabase();
  await Product.updateMany(
    { tenantId: key, extras: { $exists: false } },
    [{
      $set: {
        // Recortado y sin vacíos, para que el extra migrado pase las mismas validaciones que uno nuevo.
        extras: {
          $map: {
            input: {
              $filter: {
                input: { $map: { input: { $ifNull: ["$toppings", []] }, as: "t", in: { $trim: { input: { $toString: "$$t" } } } } },
                as: "n",
                cond: { $gt: [{ $strLenCP: "$$n" }, 0] },
              },
            },
            as: "n",
            in: { name: { $substrCP: ["$$n", 0, MAX_EXTRA_NAME] }, price: 0 },
          },
        },
      },
    }],
    { updatePipeline: true }
  );
  migratedTenants.add(key);
}

/**
 * Resuelve los extras que eligió el cliente (por nombre) contra los extras ACTUALES del producto y
 * devuelve la copia congelada con el precio del catálogo; el precio que mande el cliente no se usa.
 * Devuelve null si algún nombre no existe en el producto. Nombres repetidos cuentan una sola vez.
 */
export function resolveChosenExtras(productExtras: unknown, chosen: unknown): LineExtra[] | null {
  if (chosen === undefined || chosen === null) return [];
  if (!Array.isArray(chosen)) return null;
  const catalog = normalizeExtras(productExtras) ?? [];
  const byName = new Map(catalog.map((e) => [e.name, e]));
  const out: LineExtra[] = [];
  const seen = new Set<string>();
  for (const c of chosen) {
    const name = typeof c === "string" ? c.trim() : typeof c?.name === "string" ? c.name.trim() : "";
    const extra = byName.get(name);
    if (!extra) return null;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name: extra.name, price: extra.price });
  }
  return out;
}
