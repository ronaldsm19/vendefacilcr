import { connectToDatabase } from "@/lib/mongodb";
import { SalonTable } from "@/models/SalonTable";
import { Comanda } from "@/models/Comanda";
import { buildStatusUpdate, computeTableStatusFromComandas, type ComandaStatusLike } from "@/lib/tableStatus";

/**
 * Recalcula el estado de una mesa a partir de sus comandas. Solo actúa si la mesa está "ocupada".
 * - Quedan comandas abiertas → no hace nada.
 * - Sin abiertas y al menos una "pagada" en esta ocupación → por_limpiar (dirtyAt).
 * - Sin abiertas y todas "anulada" en esta ocupación → libre.
 * "Esta ocupación" = comandas con sentAt >= table.occupiedAt (todas si occupiedAt es null).
 */
export async function syncTableWithComandas(tenantId: string, tableId: string): Promise<void> {
  await connectToDatabase();
  const table = await SalonTable.findOne({ _id: tableId, tenantId }).lean();
  if (!table || table.status !== "ocupada") return;

  const since = table.occupiedAt ?? new Date(0);
  const comandas = await Comanda.find({
    tenantId,
    tableId,
    $or: [{ sentAt: { $gte: since } }, { status: { $in: ["enviada", "servida"] } }],
  }).select("status").lean() as ComandaStatusLike[];

  const next = computeTableStatusFromComandas(table.status, comandas);
  if (next === null) return;

  await SalonTable.updateOne(
    { _id: tableId, tenantId },
    { $set: buildStatusUpdate(table.status, next) }
  );
}
