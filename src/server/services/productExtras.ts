import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { MAX_EXTRA_NAME, MAX_EXTRA_QTY, normalizeExtras, type LineExtra } from "@/lib/pricing";

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
 * Resuelve los extras que eligió el cliente contra los extras ACTUALES del producto y devuelve la
 * copia congelada con el precio del catálogo; el precio que mande el cliente no se usa. Cada extra
 * llega como nombre ("Queso extra" = 1 porción) o como { name, qty }; el mismo nombre repetido suma
 * porciones. Devuelve null si algún nombre no existe en el producto o las porciones no son válidas.
 */
export function resolveChosenExtras(productExtras: unknown, chosen: unknown): LineExtra[] | null {
  if (chosen === undefined || chosen === null) return [];
  if (!Array.isArray(chosen)) return null;
  const catalog = normalizeExtras(productExtras) ?? [];
  const byName = new Map(catalog.map((e) => [e.name, e]));
  const out: LineExtra[] = [];
  for (const c of chosen) {
    const name = typeof c === "string" ? c.trim() : typeof c?.name === "string" ? c.name.trim() : "";
    const qty = typeof c === "string" || c?.qty === undefined ? 1 : c.qty;
    const extra = byName.get(name);
    if (!extra || !Number.isInteger(qty) || qty < 1) return null;
    const same = out.find((e) => e.name === name);
    if (same) same.qty = (same.qty ?? 1) + qty;
    else out.push({ name: extra.name, price: extra.price, qty });
    if ((same?.qty ?? qty) > MAX_EXTRA_QTY) return null;
  }
  return out;
}
