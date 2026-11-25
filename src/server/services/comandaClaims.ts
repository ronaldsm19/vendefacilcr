import mongoose from "mongoose";
import { Sale, type ISaleComandaClaim } from "@/models/Sale";
import { remapClaims } from "@/lib/comandaEdit";

/**
 * Las ventas guardan qué línea de la comanda cobraron por su posición. Cuando una edición mueve
 * líneas ya cobradas (porque se quitó algo pendiente que estaba antes), esas ventas tienen que
 * apuntar a la posición nueva: si no, al eliminar la venta se devolvería el pago a otra línea.
 */
export async function remapComandaClaims(
  tenantId: string,
  comandaId: string,
  saleIds: string[],
  indexMap: Map<number, number>,
): Promise<void> {
  const ids = saleIds.filter((s) => mongoose.isValidObjectId(s));
  if (ids.length === 0) return;
  const sales = await Sale.find({ _id: { $in: ids }, tenantId })
    .select("comandaClaims")
    .lean<{ _id: unknown; comandaClaims?: ISaleComandaClaim[] }[]>();
  const ops = sales
    .filter((s) => (s.comandaClaims ?? []).some((c) => c.comandaId === comandaId))
    .map((s) => ({
      updateOne: {
        filter: { _id: s._id as mongoose.Types.ObjectId, tenantId },
        update: { $set: { comandaClaims: remapClaims(s.comandaClaims ?? [], comandaId, indexMap) } },
      },
    }));
  if (ops.length > 0) await Sale.bulkWrite(ops);
}
