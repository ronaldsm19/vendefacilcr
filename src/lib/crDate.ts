/**
 * Utilidades de fecha en hora de Costa Rica (UTC-6, sin horario de verano).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO:
 * el servidor de Vercel corre en UTC, seis horas adelante de Costa Rica. Si un
 * route handler calcula el día con `new Date(now.getFullYear(), now.getMonth(),
 * now.getDate())`, obtiene la medianoche del día UTC, que en Costa Rica son las
 * 18:00 del día anterior. A partir de esa hora el servidor ya está en el día
 * siguiente y la ventana del "día de hoy" queda corrida seis horas.
 *
 * Eso causó un bug real en el cierre de caja: las ventas hechas antes de las
 * 18:00 desaparecían del cierre cuando el cierre se hacía después de las 18:00.
 *
 * REGLA: en código de servidor, cualquier rango de días se arma con estas
 * funciones. Nunca con los getters locales de Date.
 */

const CR_OFFSET = 6 * 60 * 60 * 1000; // Costa Rica = UTC-6 sin DST
const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche (00:00 hora de Costa Rica) del día que contiene `d`. */
export function startOfDayCR(d: Date = new Date()): Date {
  const cr = new Date(d.getTime() - CR_OFFSET);
  return new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate()) + CR_OFFSET);
}

/** Medianoche de hoy en Costa Rica. */
export function startOfTodayCR(now: Date = new Date()): Date {
  return startOfDayCR(now);
}

/**
 * Medianoche del día SIGUIENTE al que contiene `d`, en Costa Rica.
 * Es un límite EXCLUSIVO: se usa con `$lt`, nunca con `$lte`. Así no se pierde
 * ningún registro de los últimos milisegundos del día.
 */
export function endOfDayExclusiveCR(d: Date = new Date()): Date {
  return new Date(startOfDayCR(d).getTime() + DAY_MS);
}

/**
 * Rango del día que contiene `d`, en hora de Costa Rica.
 * Se consulta como `{ $gte: from, $lt: to }`.
 */
export function dayRangeCR(d: Date = new Date()): { from: Date; to: Date } {
  const from = startOfDayCR(d);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}
