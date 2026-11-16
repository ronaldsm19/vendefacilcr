import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { ServiceError } from "@/server/errors";
import { MAX_BARCODE, normalizeBarcode } from "@/lib/barcode";

/** Error de índice único de Mongo (dos guardados del mismo código a la vez). */
function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Valida un código para un producto del negocio y lo devuelve limpio ("" = sin código).
 * Rechaza caracteres que un lector no manda y un código que ya tiene otro producto, diciendo cuál,
 * para que quien lo asigna sepa dónde está repetido.
 */
export async function resolveBarcode(
  tenantId: string,
  raw: unknown,
  exceptProductId?: string
): Promise<string> {
  const code = normalizeBarcode(raw);
  if (code === null) {
    throw new ServiceError(
      400,
      `El código solo puede tener letras sin tilde, números y los signos - . / + % $, sin espacios, hasta ${MAX_BARCODE} caracteres`
    );
  }
  if (code === "") return "";

  await connectToDatabase();
  const filter: Record<string, unknown> = { tenantId, barcode: code };
  if (exceptProductId && mongoose.isValidObjectId(exceptProductId)) filter._id = { $ne: exceptProductId };
  const owner = await Product.findOne(filter).select("name").lean<{ name: string } | null>();
  if (owner) throw new ServiceError(409, `El código ${code} ya lo tiene "${owner.name}"`, "BARCODE_TAKEN");
  return code;
}

/** Traduce un choque del índice único (carrera entre dos guardados) al mismo mensaje de repetido. */
export function barcodeConflict(err: unknown): ServiceError | null {
  return isDuplicateKey(err) ? new ServiceError(409, "Ese código ya lo tiene otro producto", "BARCODE_TAKEN") : null;
}

/** Asigna (o quita, con "") el código de un producto. Devuelve el código guardado. */
export async function setProductBarcode(tenantId: string, productId: string, raw: unknown): Promise<string> {
  if (!mongoose.isValidObjectId(productId)) throw new ServiceError(404, "Producto no encontrado");
  const code = await resolveBarcode(tenantId, raw, productId);
  try {
    const res = await Product.updateOne({ _id: productId, tenantId }, { $set: { barcode: code } });
    if (res.matchedCount === 0) throw new ServiceError(404, "Producto no encontrado");
  } catch (err) {
    throw barcodeConflict(err) ?? err;
  }
  return code;
}
