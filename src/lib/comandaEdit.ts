// Editar una comanda que ya tiene algo cobrado (cuenta dividida a medio pagar). Módulo puro: lo usan
// el servidor para armar la comanda nueva y la pantalla para mostrar qué se puede tocar.
//
// Regla: lo cobrado no se toca. Cada línea se parte en dos: la parte pagada queda congelada (con
// cantidad = lo pagado) y la parte pendiente es la que se edita, se quita o se amplía.

export interface PaidAwareItem {
  quantity: number;
  paidQty?: number;
}

/** Unidades ya cobradas de la comanda. Sirve de candado: si cambia entre leer y guardar, hubo un cobro. */
export function paidUnits(items: PaidAwareItem[]): number {
  return items.reduce((s, i) => s + (i.paidQty ?? 0), 0);
}

export function hasPaidItems(items: PaidAwareItem[]): boolean {
  return items.some((i) => (i.paidQty ?? 0) > 0);
}

/** Lo que ya se cobró, línea por línea: es lo que queda fijo al editar. */
export function paidView<T extends PaidAwareItem>(items: T[]): T[] {
  return items
    .filter((i) => (i.paidQty ?? 0) > 0)
    .map((i) => ({ ...i, quantity: i.paidQty ?? 0 }));
}

/** Lo que falta cobrar, línea por línea: es lo que se puede editar. */
export function pendingView<T extends PaidAwareItem>(items: T[]): T[] {
  return items
    .filter((i) => i.quantity - (i.paidQty ?? 0) > 0)
    .map((i) => ({ ...i, quantity: i.quantity - (i.paidQty ?? 0), paidQty: 0 }));
}

export interface ComandaEditPlan<T> {
  /** Ítems con que queda la comanda: primero lo cobrado (congelado), después lo pendiente nuevo. */
  items: T[];
  /**
   * A qué posición pasó cada línea cobrada (posición vieja → nueva). Las ventas guardan qué línea
   * cobraron por posición, así que si alguna se movió hay que actualizar esas ventas.
   */
  indexMap: Map<number, number>;
  /** true si alguna línea cobrada cambió de posición. */
  moved: boolean;
  /** true si no queda nada pendiente: la comanda se cierra como pagada. */
  nothingPending: boolean;
}

/**
 * Arma la comanda que resulta de reemplazar TODO lo pendiente por `pending`. Sin nada cobrado es
 * un reemplazo normal; con algo cobrado, esas líneas quedan intactas al inicio.
 */
export function planComandaEdit<T extends PaidAwareItem>(oldItems: T[], pending: T[]): ComandaEditPlan<T> {
  const indexMap = new Map<number, number>();
  const locked: T[] = [];
  oldItems.forEach((item, oldIndex) => {
    const paid = item.paidQty ?? 0;
    if (paid <= 0) return;
    indexMap.set(oldIndex, locked.length);
    locked.push({ ...item, quantity: paid });
  });
  let moved = false;
  for (const [from, to] of indexMap) if (from !== to) moved = true;
  return {
    items: [...locked, ...pending],
    indexMap,
    moved,
    nothingPending: pending.length === 0,
  };
}

export interface ClaimLike {
  comandaId: string;
  items: { index: number; qty: number }[];
}

/** Las líneas que una venta cobró de esta comanda, con las posiciones nuevas. */
export function remapClaims<C extends ClaimLike>(claims: C[], comandaId: string, indexMap: Map<number, number>): C[] {
  return claims.map((c) =>
    c.comandaId !== comandaId
      ? c
      : { ...c, items: c.items.map((it) => ({ ...it, index: indexMap.get(it.index) ?? it.index })) }
  );
}
