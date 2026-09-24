import mongoose from "mongoose";
import { Product } from "@/models/Product";
import type { IComandaItem } from "@/models/Comanda";
import { ServiceError } from "@/server/errors";
import { extrasKey, lineTotal, normalizeExtras, type LineExtra } from "@/lib/pricing";

export interface SaleItemRecord {
  productId: string;
  productName: string;
  unitPrice: number;      // precio base
  quantity: number;
  extras: LineExtra[];
  lineTotal: number;      // (base + extras) × cantidad, calculado acá con src/lib/pricing.ts
}

/** Ítem tal como llega del POS: si viene de una comanda, dice de cuál y de qué posición. */
export interface ParsedSaleItem extends SaleItemRecord {
  comandaRef: { comandaId: string; index: number } | null;
}

/**
 * Valida la forma de los ítems de una venta (crear o editar) y calcula el total de cada línea con el
 * helper compartido; el lineTotal que mande el cliente se ignora. Devuelve null si algún ítem no es
 * válido. Los precios todavía NO están verificados: eso lo hacen checkCatalogPrices y
 * checkComandaLines.
 */
export function parseSaleItems(raw: unknown): ParsedSaleItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ParsedSaleItem[] = [];
  for (const i of raw as Record<string, unknown>[]) {
    if (typeof i?.productName !== "string" || i.productName.trim() === "") return null;
    if (typeof i.unitPrice !== "number" || !Number.isFinite(i.unitPrice) || i.unitPrice < 0) return null;
    if (!Number.isInteger(i.quantity) || (i.quantity as number) < 1) return null;
    const extras = normalizeExtras(i.extras);
    if (!extras) return null;
    const hasRef = i.comandaId !== undefined || i.comandaIndex !== undefined;
    if (hasRef && (
      typeof i.comandaId !== "string" || !mongoose.isValidObjectId(i.comandaId) ||
      !Number.isInteger(i.comandaIndex) || (i.comandaIndex as number) < 0
    )) return null;
    const line = {
      productId:   typeof i.productId === "string" ? i.productId : "",
      productName: i.productName.trim(),
      unitPrice:   i.unitPrice,
      quantity:    i.quantity as number,
      extras,
    };
    out.push({
      ...line,
      lineTotal: lineTotal(line),
      comandaRef: hasRef ? { comandaId: i.comandaId as string, index: i.comandaIndex as number } : null,
    });
  }
  return out;
}

/** Misma línea (producto, precio base y extras con sus precios), sin importar la cantidad. */
export function saleLineKey(l: Pick<SaleItemRecord, "productId" | "unitPrice" | "extras">): string {
  return `${l.productId}|${l.unitPrice}|${extrasKey(l.extras)}`;
}

function colones(n: number): string {
  return `₡${n.toLocaleString("es-CR")}`;
}

function record(l: Omit<SaleItemRecord, "lineTotal">): SaleItemRecord {
  return { ...l, lineTotal: lineTotal(l) };
}

/**
 * Verifica contra el catálogo ACTUAL las líneas que el cajero armó en el POS: el producto tiene que
 * existir en el negocio y el precio base y el de cada extra tienen que ser los del catálogo. Si algo
 * cambió desde que se cargó la pantalla, lanza 409 PRICE_CHANGED en vez de cobrar un monto distinto
 * del que ve el cajero. `keep` son líneas que se aceptan tal cual (las que ya tenía una venta que se
 * está editando: se cobraron a su precio de ese momento).
 */
export async function checkCatalogPrices(
  tenantId: string,
  items: SaleItemRecord[],
  keep: Set<string> = new Set(),
): Promise<SaleItemRecord[]> {
  const toCheck = items.filter((i) => !keep.has(saleLineKey(i)));
  const ids = Array.from(new Set(toCheck.map((i) => i.productId).filter((id) => mongoose.isValidObjectId(id))));
  const products = ids.length > 0
    ? await Product.find({ _id: { $in: ids }, tenantId }).select("name price extras").lean() as Array<{ _id: unknown; name: string; price: number; extras?: unknown }>
    : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return items.map((item) => {
    if (keep.has(saleLineKey(item))) {
      const { productId, productName, unitPrice, quantity, extras } = item;
      return record({ productId, productName, unitPrice, quantity, extras });
    }
    const p = byId.get(item.productId);
    if (!p) {
      throw new ServiceError(409, `"${item.productName}" ya no está en el catálogo.`, "PRICE_CHANGED");
    }
    if (p.price !== item.unitPrice) {
      throw new ServiceError(409, `El precio de "${p.name}" cambió de ${colones(item.unitPrice)} a ${colones(p.price)}.`, "PRICE_CHANGED");
    }
    const catalogExtras = normalizeExtras(p.extras) ?? [];
    const extras = item.extras.map((e) => {
      const c = catalogExtras.find((x) => x.name === e.name);
      if (!c) {
        throw new ServiceError(409, `El extra "${e.name}" de "${p.name}" ya no existe.`, "PRICE_CHANGED");
      }
      if (c.price !== e.price) {
        throw new ServiceError(409, `El extra "${e.name}" de "${p.name}" cambió de ${colones(e.price)} a ${colones(c.price)}.`, "PRICE_CHANGED");
      }
      return { name: c.name, price: c.price };
    });
    return record({ productId: item.productId, productName: p.name, unitPrice: p.price, quantity: item.quantity, extras });
  });
}

export interface ComandaSelectionForCheck {
  comandaId: string;
  number: number;
  items: { index: number; qty: number }[];
}

/**
 * Las líneas que vienen de comandas se cobran a lo que quedó congelado en la comanda (precio base y
 * extras al comandar), no al catálogo de hoy. Cada ítem seleccionado del panel de mesas tiene que
 * venir exactamente una vez, con la cantidad seleccionada y los mismos precios; si no, 409.
 */
export function checkComandaLines(
  linked: ParsedSaleItem[],
  selections: ComandaSelectionForCheck[],
  comandaItems: Map<string, IComandaItem[]>,
): SaleItemRecord[] {
  const mismatch = () => new ServiceError(
    409,
    "Los productos de la mesa no coinciden con las comandas. Recargá las mesas (o la página) y volvé a seleccionar.",
    "COMANDA_ITEMS_MISMATCH",
  );
  const expected = new Map<string, { qty: number; src: IComandaItem }>();
  for (const sel of selections) {
    const items = comandaItems.get(sel.comandaId) ?? [];
    for (const it of sel.items) expected.set(`${sel.comandaId}:${it.index}`, { qty: it.qty, src: items[it.index] });
  }

  const used = new Set<string>();
  const out = linked.map((item) => {
    const key = `${item.comandaRef!.comandaId}:${item.comandaRef!.index}`;
    const exp = expected.get(key);
    if (!exp || !exp.src || used.has(key) || exp.qty !== item.quantity) throw mismatch();
    used.add(key);
    const snapshot = {
      productId: String(exp.src.productId),
      unitPrice: exp.src.unitPrice,
      extras: normalizeExtras(exp.src.extras) ?? [],
    };
    if (saleLineKey(item) !== saleLineKey(snapshot)) throw mismatch();
    return record({ ...snapshot, productName: exp.src.productName, quantity: item.quantity });
  });
  if (used.size !== expected.size) throw mismatch();
  return out;
}
