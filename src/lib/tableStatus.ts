import type { TableStatus } from "@/models/SalonTable";

export type { TableStatus };

export const TABLE_STATUSES = ["libre", "ocupada", "por_limpiar", "reservada"] as const;

export const TABLE_STATUS_META: Record<TableStatus, { bg: string; border: string; label: string }> = {
  libre:       { bg: "#22c55e", border: "#16a34a", label: "Libre" },
  ocupada:     { bg: "#ef4444", border: "#dc2626", label: "Ocupada" },
  por_limpiar: { bg: "#8b5cf6", border: "#7c3aed", label: "Por limpiar" },
  reservada:   { bg: "#f59e0b", border: "#d97706", label: "Reservada" },
};

/** Orden para la vista Lista y para ordenar por prioridad de atención. */
export const TABLE_STATUS_ORDER: Record<TableStatus, number> = {
  ocupada: 0, por_limpiar: 1, reservada: 2, libre: 3,
};

export function isTableStatus(v: unknown): v is TableStatus {
  return typeof v === "string" && (TABLE_STATUSES as readonly string[]).includes(v);
}

/** Campos de estado que viven en SalonTable. Se usa tanto en docs lean como en el cliente. */
export interface TableStatusFields {
  status: TableStatus;
  statusNote: string;
  occupiedAt: Date | string | null;
  dirtyAt: Date | string | null;
  cleanedAt: Date | string | null;
  cleanedBy: string;
}

/**
 * Devuelve el objeto para `$set` al pasar una mesa al estado `next`.
 * - ocupada:     occupiedAt = now, dirtyAt/cleanedAt = null, cleanedBy = "", statusNote = note ?? "".
 *                (limpia los datos de limpieza del ciclo anterior: una mesa reocupada no debe
 *                conservar el cleanedBy del ciclo que ya cerró).
 * - por_limpiar: dirtyAt = now, statusNote = "".
 * - libre:       statusNote = "", occupiedAt/dirtyAt = null; si venía de por_limpiar,
 *                cleanedAt = now y cleanedBy = byName ?? ""; si venía de cualquier otro estado,
 *                cleanedAt = null y cleanedBy = "" (nunca se dejan los valores viejos).
 * - reservada:   statusNote = note ?? "" (no toca timestamps).
 * `now` permite sellar el timestamp con una fecha distinta de `new Date()`; Fase 3 y Fase 5 lo
 * usan al abrir la mesa para que `occupiedAt` coincida con el `sentAt` de la primera comanda.
 */
export function buildStatusUpdate(
  current: TableStatus,
  next: TableStatus,
  opts: { now?: Date; note?: string; byName?: string } = {}
): Record<string, unknown> {
  const now = opts.now ?? new Date();
  switch (next) {
    case "ocupada":
      return { status: next, statusNote: opts.note ?? "", occupiedAt: now, dirtyAt: null, cleanedAt: null, cleanedBy: "" };
    case "por_limpiar":
      return { status: next, statusNote: "", dirtyAt: now };
    case "libre":
      return {
        status: next, statusNote: "", occupiedAt: null, dirtyAt: null,
        cleanedAt: current === "por_limpiar" ? now : null,
        cleanedBy: current === "por_limpiar" ? (opts.byName ?? "") : "",
      };
    case "reservada":
      return { status: next, statusNote: opts.note ?? "" };
  }
}

export type ComandaStatus = "enviada" | "servida" | "pagada" | "anulada";
export interface ComandaStatusLike { status: ComandaStatus }

export function isOpenComanda(c: ComandaStatusLike): boolean {
  return c.status === "enviada" || c.status === "servida";
}

/**
 * Recalcula el estado de una mesa a partir de las comandas de su ciclo actual
 * (Fase 3/5 pasan las comandas del ciclo actual: sentAt >= occupiedAt si occupiedAt existe,
 * o todas las de la mesa si es null. Para que la comanda que ABRE la mesa caiga dentro del
 * ciclo, la transición a "ocupada" debe sellar occupiedAt con el sentAt de esa comanda,
 * no con new Date(): ver buildStatusUpdate(..., { now }) y la sección 6.)
 * Devuelve el nuevo estado o null si no cambia.
 * Reglas del contrato §2:
 * - hay comanda abierta y la mesa está libre/reservada/por_limpiar → "ocupada"
 *   (Fase 7 agrega "por_limpiar": al eliminar una venta una comanda "pagada" puede volver a
 *   abrirse, y por_limpiar es el estado más común en el que queda una mesa justo después de
 *   cobrar — no solo "libre" — así que también debe poder reabrirse desde ahí.)
 * - mesa ocupada sin comandas abiertas: alguna pagada → "por_limpiar"; todas anuladas → "libre"
 * - sin comandas en absoluto → null (ocupación manual, no se toca)
 */
export function computeTableStatusFromComandas(
  current: TableStatus,
  comandas: ComandaStatusLike[]
): TableStatus | null {
  const hasOpen = comandas.some(isOpenComanda);
  if (hasOpen) return current === "ocupada" ? null : "ocupada";
  if (current !== "ocupada" || comandas.length === 0) return null;
  if (comandas.some(c => c.status === "pagada")) return "por_limpiar";
  if (comandas.every(c => c.status === "anulada")) return "libre";
  return null;
}

/**
 * Minutos transcurridos desde `since` (ISO o Date) hasta `now`, redondeados — no truncados —
 * para que coincidan con el badge de comandas (`activeAvgMinutes`, que también redondea). Con
 * `since === now` da el mismo número que ese badge en vez de ir sistemáticamente un minuto atrás.
 * null si no hay fecha.
 */
export function minutesSince(since: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!since) return null;
  const t = new Date(since).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now.getTime() - t) / 60000));
}
