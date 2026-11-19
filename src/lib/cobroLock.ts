/**
 * Candado suave ("lease") para cobrar una mesa desde el POS (Fase 2 multi-cuenta).
 *
 * Mientras una caja está cobrando una mesa, la toma con `claim` y la renueva con un heartbeat.
 * Las demás cajas la ven "en cobro por …" y no la pueden cobrar. Si la caja se cae o cierra, el
 * lease vence solo (no queda una mesa bloqueada para siempre). El cobro final sigue protegido por
 * la concurrencia dura de la comanda (`version`) en POST /api/admin/sales; esto es solo el aviso
 * ANTES de empezar.
 */

/** Cuánto dura el lease sin renovarse (ms). Si la caja no hace heartbeat en este tiempo, se libera. */
export const LEASE_MS = 60_000;

/** Cada cuánto el POS renueva (heartbeat) los leases de las mesas que tiene abiertas (ms). */
export const HEARTBEAT_MS = 20_000;

export interface CobroLock {
  by: string;
  byName: string;
  at: Date | string;
  expiresAt: Date | string;
}

/** ¿El lease sigue vigente? (existe y no ha vencido). */
export function lockIsActive(lock: CobroLock | null | undefined, now: Date = new Date()): boolean {
  if (!lock || !lock.expiresAt) return false;
  return new Date(lock.expiresAt).getTime() > now.getTime();
}

/** Vista pública del lock para el frontend: null si no está vigente. `mine` = lo tiene esta caja. */
export function publicLock(
  lock: CobroLock | null | undefined,
  myUserId: string,
  now: Date = new Date()
): { byName: string; mine: boolean } | null {
  if (!lockIsActive(lock, now)) return null;
  return { byName: lock!.byName || "otra caja", mine: lock!.by === myUserId };
}
