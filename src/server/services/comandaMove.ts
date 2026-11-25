import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda, type IComanda } from "@/models/Comanda";
import { SalonTable, type ISalonTable } from "@/models/SalonTable";
import { TableArea } from "@/models/TableArea";
import { buildStatusUpdate } from "@/lib/tableStatus";
import { lockIsActive } from "@/lib/cobroLock";
import { ServiceError } from "@/server/errors";
import { enqueueComandaPrint } from "@/lib/printQueue";
import { withKitchenNotes } from "@/lib/kitchenText";
import { pendingView } from "@/lib/comandaEdit";

export interface MoveComandasInput {
  tenantId: string;
  fromTableId: string;
  toTableId: string;
  /** Si viene, se pasa solo esa comanda; si no, todas las abiertas de la mesa. */
  comandaId?: string;
}

export interface MoveComandasResult {
  moved: number;
  from: ISalonTable;
  to: ISalonTable;
}

const OPEN = ["enviada", "servida"];

/**
 * Pasa las comandas abiertas de una mesa a otra mesa LIBRE: la gente se cambió de mesa y la cuenta
 * se va con ella. La mesa nueva queda ocupada desde la misma hora y la vieja, si no le quedan
 * comandas abiertas, queda por limpiar. Las comandas suben de versión: un cobro armado antes del
 * cambio se rechaza en vez de cobrar la mesa equivocada.
 *
 * A cocina y barra les sale un tiquete de "actualizada" con la mesa nueva, solo de lo que todavía
 * no se ha servido. Lanza ServiceError (404/409) si algo no se puede.
 */
export async function moveOpenComandas(input: MoveComandasInput): Promise<MoveComandasResult> {
  const { tenantId, fromTableId, toTableId, comandaId } = input;
  for (const id of [fromTableId, toTableId, ...(comandaId ? [comandaId] : [])]) {
    if (!mongoose.isValidObjectId(id)) throw new ServiceError(404, "No encontrado");
  }
  if (fromTableId === toTableId) throw new ServiceError(400, "Elegí una mesa distinta");
  await connectToDatabase();

  const [from, to] = await Promise.all([
    SalonTable.findOne({ _id: fromTableId, tenantId }).lean<ISalonTable | null>(),
    SalonTable.findOne({ _id: toTableId, tenantId }).lean<ISalonTable | null>(),
  ]);
  if (!from || !to) throw new ServiceError(404, "Mesa no encontrada");
  if (to.status !== "libre") {
    throw new ServiceError(409, `La mesa ${to.label} no está libre. Elegí una mesa libre.`);
  }
  if (lockIsActive(from.cobroLock)) {
    throw new ServiceError(409, `La mesa ${from.label} se está cobrando en caja (${from.cobroLock?.byName ?? "otra caja"}). Esperá a que termine.`);
  }

  const filter: Record<string, unknown> = { tenantId, tableId: fromTableId, status: { $in: OPEN } };
  if (comandaId) filter._id = comandaId;
  const comandas = await Comanda.find(filter).lean<IComanda[]>();
  if (comandas.length === 0) {
    throw new ServiceError(409, comandaId ? "La comanda ya no está abierta en esa mesa" : "La mesa no tiene comandas abiertas");
  }

  const area = await TableArea.findOne({ _id: to.areaId, tenantId }).select("name").lean<{ name?: string } | null>();
  const areaName = area?.name ?? "";

  // La mesa nueva se toma solo si sigue libre: dos personas no pueden pasar gente a la misma mesa.
  const occupiedAt = from.occupiedAt ?? comandas.reduce<Date>((min, c) => (c.sentAt < min ? c.sentAt : min), comandas[0].sentAt);
  const toUpdated = await SalonTable.findOneAndUpdate(
    { _id: toTableId, tenantId, status: "libre" },
    { $set: buildStatusUpdate("libre", "ocupada", { now: new Date(occupiedAt) }) },
    { new: true }
  ).lean<ISalonTable | null>();
  if (!toUpdated) throw new ServiceError(409, `La mesa ${to.label} se acaba de ocupar. Elegí otra.`);

  const res = await Comanda.updateMany(
    { _id: { $in: comandas.map((c) => c._id) }, tenantId, tableId: fromTableId, status: { $in: OPEN } },
    { $set: { tableId: toTableId, tableLabel: to.label, areaId: to.areaId, areaName }, $inc: { version: 1 } }
  );
  if (res.modifiedCount === 0) {
    // Nada se pasó (alguien las cobró o anuló justo antes): la mesa nueva vuelve a quedar libre.
    await SalonTable.updateOne({ _id: toTableId, tenantId }, { $set: buildStatusUpdate("ocupada", "libre") });
    throw new ServiceError(409, "Las comandas cambiaron mientras tanto. Recargá e intentá de nuevo.");
  }

  // Mesa vieja: si no le quedan comandas abiertas, queda por limpiar (ahí estuvo sentada la gente).
  const stillOpen = await Comanda.countDocuments({ tenantId, tableId: fromTableId, status: { $in: OPEN } });
  let fromUpdated: ISalonTable | null = from;
  if (stillOpen === 0 && from.status !== "por_limpiar") {
    fromUpdated = await SalonTable.findOneAndUpdate(
      { _id: fromTableId, tenantId },
      { $set: buildStatusUpdate(from.status, "por_limpiar") },
      { new: true }
    ).lean<ISalonTable | null>();
  }

  // Aviso a cocina y barra: solo de las comandas que todavía no se sirvieron, y solo lo pendiente.
  for (const c of comandas) {
    if (c.status !== "enviada") continue;
    const aviso = `CAMBIO DE MESA: estaba en la mesa ${from.label}. No preparar de nuevo.`;
    try {
      await enqueueComandaPrint(withKitchenNotes({
        ...c,
        version: c.version + 1,
        tableLabel: to.label,
        areaName,
        notes: c.notes ? `${aviso} ${c.notes}` : aviso,
        items: pendingView(c.items),
      }));
    } catch (err) {
      console.error("[printQueue] cambio de mesa", err);
    }
  }

  return { moved: res.modifiedCount, from: fromUpdated ?? from, to: toUpdated };
}
