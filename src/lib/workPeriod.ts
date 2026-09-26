// Utilidades de fecha para el control de jornada laboral, en hora de Costa Rica
// (America/Costa_Rica, UTC-6 fijo, sin horario de verano — mismo patrón de offset que
// src/app/api/admin/finances/route.ts). Sin dependencias de mongoose/Next: son funciones
// puras, seguras de importar tanto en rutas de API (servidor) como en componentes "use client".

export const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

export type PeriodType = "quincena" | "mes";

/** "Ahora", expresado en campos UTC que en realidad representan la hora de pared de Costa Rica. */
export function nowInCR(): Date {
  return new Date(Date.now() - CR_OFFSET_MS);
}

/** Instante UTC real que corresponde a esa fecha/hora de pared en Costa Rica. */
export function crWallClockToUTC(
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0
): Date {
  return new Date(Date.UTC(year, monthIndex, day, hours, minutes) + CR_OFFSET_MS);
}

/** Medianoche de Costa Rica de esa fecha, como instante UTC real. */
export function crMidnightUTC(year: number, monthIndex: number, day: number): Date {
  return crWallClockToUTC(year, monthIndex, day);
}

export interface PeriodRange {
  from: Date;
  to: Date;
}

/**
 * Límites [from, to) de la quincena o el mes que contiene `refCR` (una fecha cuyos campos
 * UTC representan el calendario de Costa Rica — ej. el valor de nowInCR()). La quincena va
 * del 1 al 15 y del 16 al último día del mes. `to` siempre es la medianoche CR del primer
 * día del tramo siguiente (exclusivo), así que Date.UTC normaliza solo el fin de mes/año sin
 * necesidad de calcular el último día del mes.
 */
export function resolvePeriod(type: PeriodType, refCR: Date): PeriodRange {
  const y = refCR.getUTCFullYear();
  const m = refCR.getUTCMonth();
  const d = refCR.getUTCDate();
  if (type === "mes") {
    return { from: crMidnightUTC(y, m, 1), to: crMidnightUTC(y, m + 1, 1) };
  }
  if (d <= 15) {
    return { from: crMidnightUTC(y, m, 1), to: crMidnightUTC(y, m, 16) };
  }
  return { from: crMidnightUTC(y, m, 16), to: crMidnightUTC(y, m + 1, 1) };
}

/** Nueva fecha-referencia (campos UTC = calendario CR) desplazada un período hacia atrás/adelante. */
export function shiftPeriod(type: PeriodType, refCR: Date, direction: 1 | -1): Date {
  const y = refCR.getUTCFullYear();
  const m = refCR.getUTCMonth();
  const d = refCR.getUTCDate();
  if (type === "mes") {
    return new Date(Date.UTC(y, m + direction, 1));
  }
  if (direction === 1) {
    return d <= 15 ? new Date(Date.UTC(y, m, 16)) : new Date(Date.UTC(y, m + 1, 1));
  }
  return d <= 15 ? new Date(Date.UTC(y, m - 1, 16)) : new Date(Date.UTC(y, m, 1));
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

/** Etiqueta corta para mostrar el período, ej. "1 – 15 setiembre 2026" o "Setiembre 2026". */
export function formatPeriodLabel(type: PeriodType, refCR: Date): string {
  const y = refCR.getUTCFullYear();
  const m = refCR.getUTCMonth();
  const d = refCR.getUTCDate();
  const monthName = MONTHS_ES[m];
  if (type === "mes") {
    return `${monthName[0].toUpperCase()}${monthName.slice(1)} ${y}`;
  }
  return d <= 15 ? `1 – 15 ${monthName} ${y}` : `16 – fin de ${monthName} ${y}`;
}

/** "48 h 30 min" a partir de minutos totales. */
export function formatHoursMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h} h ${m} min`;
}

/** "YYYY-MM-DDTHH:mm" en hora de pared de Costa Rica, para el value de un input datetime-local. */
export function toCRInputValue(date: Date): string {
  const n = new Date(date.getTime() - CR_OFFSET_MS);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}T${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}`;
}

/** El input datetime-local se interpreta siempre como hora de Costa Rica, sin importar en qué
 * huso horario esté el navegador o el servidor — evita que "las 2pm" que escribe el admin se
 * conviertan silenciosamente en otra hora real por una zona horaria distinta a la de por medio. */
export function crInputToUTC(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return crWallClockToUTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "YYYY-MM-DD" del día de Costa Rica en que cae ese instante (para agrupar jornadas por día). */
export function crDayKey(date: Date): string {
  return new Date(date.getTime() - CR_OFFSET_MS).toISOString().slice(0, 10);
}

/** "Jueves 25 de setiembre" a partir de una clave de crDayKey. */
export function formatCRDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = DAYS_ES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday[0].toUpperCase()}${weekday.slice(1)} ${d} de ${MONTHS_ES[m - 1]}`;
}

/** "03:00 p. m." en hora de Costa Rica, sin importar la zona horaria del navegador. */
export function formatCRTime(date: Date): string {
  return date.toLocaleTimeString("es-CR", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit" });
}
