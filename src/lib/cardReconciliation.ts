// Cuadre del datáfono al cerrar el día: lo que el sistema registró en tarjeta contra el total que
// imprime el datáfono en su propio cierre. Módulo puro: la pantalla lo usa para avisar en vivo y el
// servidor para decidir si deja cerrar, con las mismas reglas.

export const MAX_CARD_NOTE = 200;

/** El día tuvo ventas con tarjeta y no vino el total del datáfono. */
export const CARD_RECONCILIATION_REQUIRED = "CARD_RECONCILIATION_REQUIRED";
/** El total del datáfono no cuadra con el sistema y no se explicó la diferencia. */
export const CARD_NOTE_REQUIRED = "CARD_NOTE_REQUIRED";
/** Vino un total que no es un monto válido. */
export const CARD_REPORTED_INVALID = "CARD_REPORTED_INVALID";

export interface CardReconciliation {
  /** Tarjeta según las ventas del día, calculado por el servidor. */
  expected: number;
  /** Total del cierre del datáfono, digitado por quien cierra. */
  reported: number;
  /** reported − expected. Positivo = el datáfono cobró de más. */
  difference: number;
  /** Explicación de la diferencia. Obligatoria cuando difference ≠ 0. */
  note: string;
  checkedBy: string;
  checkedAt: Date;
}

export interface CardReconciliationInput {
  reported?: unknown;
  note?: unknown;
}

/**
 * Los colones no tienen céntimos pero el datáfono puede imprimir decimales, y restar dos floats
 * deja ruido (1234.1 − 1234.1 = 1.8e-13) que haría pedir una nota por una diferencia inexistente.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CardCheck =
  | { ok: true; value: CardReconciliation }
  | { ok: false; code: string; error: string };

/**
 * Valida el cuadre contra lo esperado. `expected` lo calcula quien llama a partir de las ventas,
 * nunca lo manda la pantalla: si no, bastaría con decir que el día no tuvo tarjeta para saltarse
 * el control.
 */
export function checkCardReconciliation(
  expected: number,
  input: CardReconciliationInput | null | undefined,
  checkedBy: string
): CardCheck {
  if (!input || input.reported === undefined || input.reported === null || input.reported === "") {
    return {
      ok: false,
      code: CARD_RECONCILIATION_REQUIRED,
      error: "Antes de cerrar hay que comparar el cierre del datáfono con el sistema.",
    };
  }

  const reported = Number(input.reported);
  if (!Number.isFinite(reported) || reported < 0) {
    return {
      ok: false,
      code: CARD_REPORTED_INVALID,
      error: "El total del datáfono no es un monto válido.",
    };
  }

  const difference = round2(reported - round2(expected));
  const note = String(input.note ?? "").trim().slice(0, MAX_CARD_NOTE);

  if (difference !== 0 && note === "") {
    return {
      ok: false,
      code: CARD_NOTE_REQUIRED,
      error: "El datáfono no cuadra con el sistema. Explicá la diferencia antes de cerrar.",
    };
  }

  return {
    ok: true,
    value: {
      expected: round2(expected),
      reported: round2(reported),
      difference,
      note,
      checkedBy,
      checkedAt: new Date(),
    },
  };
}

/** Texto corto del estado del cuadre, para la pantalla y el ticket. */
export function cardDifferenceLabel(difference: number): string {
  if (difference === 0) return "Cuadra con el datáfono";
  return difference > 0 ? "Sobra en el datáfono" : "Falta en el datáfono";
}

// ── Cuadre de SINPE ─────────────────────────────────────────────────────────────────────────────
// Igual que el del datáfono, pero contra lo que entró por SINPE según el banco, y OPCIONAL: no
// todos los negocios revisan el banco al cerrar, así que dejarlo vacío no bloquea el cierre. Si se
// llena y no cuadra, sí hay que anotar el motivo (casi siempre una venta que se anotó con otra
// forma de pago, o un SINPE que no se registró).

export type SinpeReconciliation = CardReconciliation;

/** El total del banco no cuadra con el sistema y no se explicó la diferencia. */
export const SINPE_NOTE_REQUIRED = "SINPE_NOTE_REQUIRED";
/** Vino un total que no es un monto válido. */
export const SINPE_REPORTED_INVALID = "SINPE_REPORTED_INVALID";

export type SinpeCheck =
  | { ok: true; value: SinpeReconciliation | null }
  | { ok: false; code: string; error: string };

/**
 * Valida el cuadre de SINPE. Sin total digitado devuelve `value: null` (no se revisó, y está bien).
 * `expected` lo calcula quien llama a partir de las ventas, nunca lo manda la pantalla.
 */
export function checkSinpeReconciliation(
  expected: number,
  input: CardReconciliationInput | null | undefined,
  checkedBy: string
): SinpeCheck {
  if (!input || input.reported === undefined || input.reported === null || input.reported === "") {
    return { ok: true, value: null };
  }
  const reported = Number(input.reported);
  if (!Number.isFinite(reported) || reported < 0) {
    return { ok: false, code: SINPE_REPORTED_INVALID, error: "El total de SINPE del banco no es un monto válido." };
  }
  const difference = round2(reported - round2(expected));
  const note = String(input.note ?? "").trim().slice(0, MAX_CARD_NOTE);
  if (difference !== 0 && note === "") {
    return {
      ok: false,
      code: SINPE_NOTE_REQUIRED,
      error: "El SINPE del banco no cuadra con el sistema. Anotá por qué antes de cerrar.",
    };
  }
  return {
    ok: true,
    value: { expected: round2(expected), reported: round2(reported), difference, note, checkedBy, checkedAt: new Date() },
  };
}

/** Texto corto del estado del cuadre de SINPE, para la pantalla y el ticket. */
export function sinpeDifferenceLabel(difference: number): string {
  if (difference === 0) return "Cuadra con el banco";
  return difference > 0 ? "Entró más SINPE del anotado" : "Entró menos SINPE del anotado";
}
