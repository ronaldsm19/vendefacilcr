import type { IComanda } from "@/models/Comanda";

/**
 * Gancho para la Fase 4 (cola de impresión).
 * TODO(Fase 4): crear un PrintJob type "comanda" por cada estación ("cocina", "bebidas")
 * que tenga ítems, con el payload docType "comanda" del contrato (sección 4), y
 * marcar "ACTUALIZADA v{version}" cuando version > 1. Los ítems "ninguna" no se imprimen.
 * En esta fase no hace nada a propósito.
 */
export async function enqueueComandaPrint(comanda: IComanda): Promise<void> {
  void comanda;
}
