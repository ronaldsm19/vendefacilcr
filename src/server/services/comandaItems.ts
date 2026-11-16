import mongoose from "mongoose";
import { Product } from "@/models/Product";
import { effectiveStation } from "@/lib/station";
import type { IComandaItem } from "@/models/Comanda";
import type { LineExtra } from "@/lib/pricing";
import { ServiceError } from "@/server/errors";
import { formatKg, normalizeWeightKg } from "@/lib/soldBy";
import { ensureExtrasMigrated, resolveChosenExtras } from "@/server/services/productExtras";

export interface ComandaItemInput {
  productId?: unknown;
  quantity?: unknown;
  note?: unknown;
  /** Nombres de los extras elegidos (o {name}); el precio sale siempre del catálogo. */
  extras?: unknown;
  /** Peso de la pieza en kilos: obligatorio en los productos por kilo, prohibido en los demás. */
  weightKg?: unknown;
}

/** Forma de los ítems que manda el celular al crear o editar una comanda. Lanza ServiceError (400). */
export function validateComandaItemsInput(items: unknown): asserts items is ComandaItemInput[] {
  if (!Array.isArray(items) || items.length === 0) throw new ServiceError(400, "Agregá al menos un producto");
  if (items.length > 200) throw new ServiceError(400, "Demasiados ítems (máx. 200)");
  for (const item of items as ComandaItemInput[]) {
    if (typeof item?.productId !== "string" || !mongoose.isValidObjectId(item.productId)) {
      throw new ServiceError(400, "Producto inválido");
    }
    if (!Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 99) {
      throw new ServiceError(400, "Cantidad inválida");
    }
    if (item.note !== undefined && (typeof item.note !== "string" || item.note.length > 200)) {
      throw new ServiceError(400, "La nota del ítem es muy larga (máx. 200)");
    }
    if (normalizeWeightKg(item.weightKg) === null) {
      throw new ServiceError(400, "Peso inválido: va en kilos, mayor que cero (p. ej. 0.350)");
    }
  }
}

/**
 * Congela ítems ya validados contra el catálogo actual: nombre, precio base, estación y extras con
 * su precio salen del producto, nunca del cliente. Lanza ServiceError (400) si un producto o un
 * extra ya no existe o no está disponible.
 */
export async function snapshotComandaItems(
  tenantId: string,
  list: ComandaItemInput[],
): Promise<(IComandaItem & { extras: LineExtra[] })[]> {
  await ensureExtrasMigrated(tenantId);
  const ids = list.map((i) => String(i.productId));
  const products = await Product.find({ _id: { $in: ids }, tenantId }).lean() as Array<Record<string, unknown>>;
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  if (products.length !== new Set(ids).size) throw new ServiceError(400, "Un producto ya no existe");
  for (const p of products) {
    if (p.available === false) throw new ServiceError(400, `"${p.name}" no está disponible`);
  }

  return list.map((i) => {
    const p = productMap.get(String(i.productId))!;
    const extras = resolveChosenExtras(p.extras, i.extras);
    if (!extras) throw new ServiceError(400, `Un extra de "${p.name}" ya no existe. Recargá el catálogo.`);
    // Un producto por kilo se comanda con el peso de la pieza; el precio sale del kilo × peso.
    const weightKg = normalizeWeightKg(i.weightKg) ?? undefined;
    if (p.soldBy === "kg" && !weightKg) {
      throw new ServiceError(400, `"${p.name}" se vende por kilo: indicá cuánto pesa.`);
    }
    if (p.soldBy !== "kg" && weightKg) {
      throw new ServiceError(400, `"${p.name}" no se vende por kilo (${formatKg(weightKg)}). Recargá el catálogo.`);
    }
    return {
      productId: String(i.productId),
      productName: p.name as string,
      unitPrice: p.price as number,
      quantity: i.quantity as number,
      station: effectiveStation(p as { station?: string; menuSection?: string }),
      note: typeof i.note === "string" ? i.note.trim() : "",
      paidQty: 0,
      extras,
      ...(weightKg ? { weightKg } : {}),
    };
  });
}
