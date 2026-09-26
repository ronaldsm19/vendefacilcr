import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { StaffUser, type StaffRole } from "@/models/StaffUser";
import { WorkShift } from "@/models/WorkShift";
import { AccessLog } from "@/models/AccessLog";
import { ServiceError } from "@/server/errors";
import { consumeAttempt, clearAttempts } from "@/server/services/rateLimit";
import {
  nowInCR, resolvePeriod, formatPeriodLabel, crDayKey, formatCRDayLabel, type PeriodRange, type PeriodType,
} from "@/lib/workPeriod";

// Control de jornada laboral. La hora siempre es la del servidor: ninguna función de este módulo
// acepta un startedAt, un endedAt de marcaje ni minutos calculados afuera. Las únicas excepciones son
// las correcciones del admin —closeShiftAsAdmin (cerrar un turno olvidado) y editShiftAsAdmin
// (corregir entrada y salida)—, que reciben las horas que elige el admin y las validan acá.

const MAX_EDIT_MOVE_MS = 12 * 60 * 60 * 1000;

const PIN_MAX_ATTEMPTS = 5;
const PIN_WINDOW_MS = 15 * 60 * 1000;
const DUPLICATE_KEY = 11000;

interface StaffLean {
  _id: { toString(): string };
  name: string;
  role: StaffRole;
  pinHash: string;
}

interface TotalRow {
  _id: { toString(): string };
  name: string;
  role: StaffRole;
  minutes: number;
  shiftsCount: number;
  openCount: number;
}

export interface AdjustActor {
  name: string;
  email?: string;
  tenantSlug: string;
  ip?: string;
  userAgent?: string;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** Rango [from, to) a partir de strings ISO; 400 si falta o no tiene sentido. */
export function parseDateRange(fromRaw: string | null, toRaw: string | null): PeriodRange {
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new ServiceError(400, "Rango de fechas inválido");
  }
  return { from, to };
}

/** Personal activo del negocio, ordenado por nombre, con su turno abierto si lo tiene. */
export async function listActiveStaff(tenantId: string) {
  await connectToDatabase();
  const staff = await StaffUser.find({ tenantId, active: true })
    .select("name role")
    .sort({ name: 1 })
    .lean<{ _id: { toString(): string }; name: string; role: StaffRole }[]>();

  const openShifts = await WorkShift.find({
    tenantId,
    status: "abierta",
    staffUserId: { $in: staff.map((s) => s._id) },
  })
    .select("staffUserId startedAt edits.fromStartedAt")
    .lean<{
      _id: { toString(): string };
      staffUserId: { toString(): string };
      startedAt: Date;
      edits?: { fromStartedAt: Date }[];
    }[]>();

  const openByStaff = new Map(openShifts.map((s) => [s.staffUserId.toString(), s]));
  return staff.map((s) => {
    const open = openByStaff.get(s._id.toString());
    return {
      _id: s._id.toString(),
      name: s.name,
      role: s.role,
      openShift: open
        ? {
            _id: open._id.toString(),
            startedAt: open.startedAt,
            // La hora que marcó de verdad, si el admin le corrigió la entrada.
            originalStartedAt: open.edits?.[0]?.fromStartedAt ?? null,
          }
        : null,
    };
  });
}

/**
 * Identifica a la persona por su PIN, comparado con bcrypt en el servidor. El intento se consume
 * antes de comparar (5 cada 15 min por persona), y solo después de confirmar que la persona
 * existe: así un id inventado no deja contadores basura en la base.
 */
async function verifyStaffPin(tenantId: string, staffUserId: string, pin: string): Promise<StaffLean> {
  if (!mongoose.isValidObjectId(staffUserId)) throw new ServiceError(404, "Personal no encontrado");
  await connectToDatabase();
  const staff = await StaffUser.findOne({ _id: staffUserId, tenantId, active: true })
    .select("name role pinHash")
    .lean<StaffLean | null>();
  if (!staff) throw new ServiceError(404, "Personal no encontrado");

  const rateKey = `shift-pin:${tenantId}:${staffUserId}`;
  if (!(await consumeAttempt(rateKey, PIN_MAX_ATTEMPTS, PIN_WINDOW_MS))) {
    throw new ServiceError(429, "Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.");
  }
  if (!(await bcrypt.compare(pin, staff.pinHash))) throw new ServiceError(403, "PIN incorrecto");
  await clearAttempts(rateKey);
  return staff;
}

export async function startShift(tenantId: string, staffUserId: string, pin: string) {
  const staff = await verifyStaffPin(tenantId, staffUserId, pin);

  if (await WorkShift.exists({ tenantId, staffUserId, status: "abierta" })) {
    throw new ServiceError(409, "Esta persona ya tiene una jornada abierta");
  }
  try {
    const shift = await WorkShift.create({
      tenantId,
      staffUserId,
      staffName: staff.name,
      staffRole: staff.role,
      startedAt: new Date(),
      status: "abierta",
    });
    return { _id: String(shift._id), startedAt: shift.startedAt as Date, staffUserId, staffName: staff.name, staffRole: staff.role };
  } catch (err) {
    // Dos pestañas marcando a la vez: el índice único parcial frena el segundo turno abierto.
    if ((err as { code?: number }).code === DUPLICATE_KEY) {
      throw new ServiceError(409, "Esta persona ya tiene una jornada abierta");
    }
    throw err;
  }
}

export async function stopShift(tenantId: string, staffUserId: string, pin: string) {
  const staff = await verifyStaffPin(tenantId, staffUserId, pin);

  const shift = await WorkShift.findOne({ tenantId, staffUserId, status: "abierta" });
  if (!shift) throw new ServiceError(409, "Esta persona no tiene una jornada abierta");

  const endedAt = new Date();
  shift.endedAt = endedAt;
  shift.minutes = minutesBetween(shift.startedAt, endedAt);
  shift.status = "cerrada";
  shift.closedBy = "staff";
  await shift.save();

  return {
    _id: String(shift._id),
    startedAt: shift.startedAt as Date,
    endedAt,
    minutes: shift.minutes as number,
    staffUserId,
    staffName: staff.name,
    staffRole: staff.role,
  };
}

/**
 * Turnos cuyo startedAt cae en el rango (un turno que cruza la medianoche cuenta completo en el día
 * en que empezó), totales por persona —solo los cerrados suman minutos— y todos los turnos abiertos
 * del negocio sin importar el rango: un turno olvidado puede haber empezado antes del período que
 * se está viendo y sigue siendo un pendiente igual.
 */
export async function getShiftsReport(tenantId: string, { from, to }: PeriodRange) {
  await connectToDatabase();
  const tenantOid = new mongoose.Types.ObjectId(tenantId);

  const [shifts, totals, openShifts] = await Promise.all([
    WorkShift.find({ tenantId, startedAt: { $gte: from, $lt: to } })
      .select("-tenantId -__v")
      .sort({ startedAt: -1 })
      .lean(),
    WorkShift.aggregate<TotalRow>([
      { $match: { tenantId: tenantOid, startedAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: "$staffUserId",
          name: { $last: "$staffName" },
          role: { $last: "$staffRole" },
          minutes: { $sum: { $cond: [{ $eq: ["$status", "cerrada"] }, "$minutes", 0] } },
          shiftsCount: { $sum: 1 },
          openCount: { $sum: { $cond: [{ $eq: ["$status", "abierta"] }, 1, 0] } },
        },
      },
      { $sort: { minutes: -1 } },
    ]),
    WorkShift.find({ tenantId, status: "abierta" })
      .select("staffUserId staffName staffRole startedAt")
      .sort({ startedAt: 1 })
      .lean(),
  ]);

  return {
    shifts,
    totals: totals.map((t) => ({
      staffUserId: t._id.toString(),
      name: t.name,
      role: t.role,
      minutes: t.minutes,
      shiftsCount: t.shiftsCount,
      openCount: t.openCount,
    })),
    openShifts,
  };
}

/**
 * Única forma de cerrar un turno que quedó abierto porque alguien olvidó marcar la salida. Las horas
 * de una jornada se corrigen aparte, con editShiftAsAdmin; no hay forma de borrar jornadas.
 */
export async function closeShiftAsAdmin(
  tenantId: string,
  shiftId: string,
  input: { endedAt: Date; note: string },
  actor: AdjustActor
) {
  if (!mongoose.isValidObjectId(shiftId)) throw new ServiceError(404, "Turno no encontrado");
  await connectToDatabase();

  const shift = await WorkShift.findOne({ _id: shiftId, tenantId });
  if (!shift) throw new ServiceError(404, "Turno no encontrado");
  if (shift.status !== "abierta") throw new ServiceError(409, "Este turno ya está cerrado");
  if (input.endedAt <= shift.startedAt) {
    throw new ServiceError(400, "La hora de salida debe ser posterior al inicio del turno");
  }
  if (input.endedAt > new Date()) throw new ServiceError(400, "La hora de salida no puede estar en el futuro");

  const minutes = minutesBetween(shift.startedAt, input.endedAt);
  shift.endedAt = input.endedAt;
  shift.minutes = minutes;
  shift.status = "cerrada";
  shift.closedBy = "admin";
  shift.adjustedByName = actor.name;
  shift.adjustNote = input.note;
  await shift.save();

  AccessLog.create({
    tenantId,
    tenantSlug: actor.tenantSlug,
    userEmail:  actor.email || actor.name,
    ip:         actor.ip ?? "unknown",
    userAgent:  actor.userAgent ?? "",
    success:    true,
    event:      "work_shift_adjust",
    path:       `workShiftId=${shiftId};staffName=${shift.staffName};minutes=${minutes}`,
  }).catch(() => {});

  return {
    _id: String(shift._id),
    staffUserId: String(shift.staffUserId),
    staffName: shift.staffName as string,
    staffRole: shift.staffRole as StaffRole,
    startedAt: shift.startedAt as Date,
    endedAt: shift.endedAt as Date,
    minutes,
    status: shift.status as string,
    closedBy: shift.closedBy as string,
    adjustedByName: shift.adjustedByName as string,
    adjustNote: shift.adjustNote as string,
  };
}

/** "24/09, 10:00 p. m." en hora de Costa Rica, para mensajes de error. */
function formatCR(date: Date): string {
  return date.toLocaleString("es-CR", {
    timeZone: "America/Costa_Rica", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Edita la entrada y/o la salida de una jornada; solo el admin llega acá. Una jornada abierta solo
 * admite corregir la entrada (la salida se marca con el PIN o con closeShiftAsAdmin); una cerrada
 * admite las dos, y sus minutos se recalculan. Cada edición queda en shift.edits y en el AccessLog.
 */
export async function editShiftAsAdmin(
  tenantId: string,
  shiftId: string,
  input: { startedAt: Date; endedAt: Date | null; note: string },
  actor: AdjustActor
) {
  if (!mongoose.isValidObjectId(shiftId)) throw new ServiceError(404, "Jornada no encontrada");
  await connectToDatabase();

  const shift = await WorkShift.findOne({ _id: shiftId, tenantId })
    .select("staffUserId staffName startedAt endedAt status payrollPaymentId")
    .lean<{
      _id: mongoose.Types.ObjectId;
      staffUserId: mongoose.Types.ObjectId;
      staffName: string;
      startedAt: Date;
      endedAt: Date | null;
      status: "abierta" | "cerrada";
      payrollPaymentId: mongoose.Types.ObjectId | null;
    } | null>();
  if (!shift) throw new ServiceError(404, "Jornada no encontrada");

  // Una jornada ya pagada no se corrige: cambiar sus horas dejaría el pago hecho sobre unos
  // minutos que ya no existen, y la planilla mostraría una deuda que nadie puede explicar.
  // Primero se anula el pago —eso la devuelve a pendiente— y después se corrige.
  if (shift.payrollPaymentId) {
    throw new ServiceError(
      409,
      "Esta jornada ya fue pagada. Anulá el pago en Planilla y después corregila."
    );
  }

  const isOpen = shift.status === "abierta";
  const { startedAt, endedAt, note } = input;
  if (isOpen && endedAt) {
    throw new ServiceError(400, "Esta jornada sigue abierta: solo se puede corregir la entrada. Para cerrarla usá «Cerrar jornada».");
  }
  if (!isOpen && !endedAt) throw new ServiceError(400, "Falta la hora de salida");

  const now = new Date();
  if (startedAt > now) throw new ServiceError(400, "La hora de entrada no puede estar en el futuro");
  if (endedAt && endedAt > now) throw new ServiceError(400, "La hora de salida no puede estar en el futuro");
  if (endedAt && endedAt <= startedAt) throw new ServiceError(400, "La salida tiene que ser después de la entrada");

  // Un salto mayor casi siempre es una fecha equivocada en el selector, no una corrección real.
  const movedTooFar = (next: Date, current: Date | null) =>
    !!current && Math.abs(next.getTime() - current.getTime()) > MAX_EDIT_MOVE_MS;
  if (movedTooFar(startedAt, shift.startedAt) || (endedAt && movedTooFar(endedAt, shift.endedAt))) {
    throw new ServiceError(400, "Una edición no puede mover la entrada ni la salida más de 12 horas. Revisá la fecha.");
  }

  const sameStart = startedAt.getTime() === shift.startedAt.getTime();
  const sameEnd = (endedAt?.getTime() ?? null) === (shift.endedAt?.getTime() ?? null);
  if (sameStart && sameEnd) throw new ServiceError(400, "No cambiaste ninguna hora");

  // No puede cruzarse con otra jornada de la misma persona; una abierta cuenta hasta ahora.
  const overlap = await WorkShift.findOne({
    tenantId,
    staffUserId: shift.staffUserId,
    _id: { $ne: shift._id },
    startedAt: { $lt: endedAt ?? now },
    $or: [{ status: "abierta" }, { endedAt: { $gt: startedAt } }],
  })
    .select("startedAt endedAt")
    .lean<{ startedAt: Date; endedAt: Date | null } | null>();
  if (overlap) {
    throw new ServiceError(
      400,
      `Se cruza con otra jornada de ${shift.staffName} (${formatCR(overlap.startedAt)} – ${overlap.endedAt ? formatCR(overlap.endedAt) : "en curso"})`
    );
  }

  const minutes = endedAt ? minutesBetween(startedAt, endedAt) : 0;

  // Condicionado a que la jornada siga como la leímos: si la persona marca la salida justo ahora,
  // sus minutos ya se calcularon con la hora vieja y no hay que pisarlos.
  const updated = await WorkShift.findOneAndUpdate(
    { _id: shift._id, tenantId, status: shift.status, startedAt: shift.startedAt, endedAt: shift.endedAt },
    {
      $set: { startedAt, endedAt, minutes },
      $push: {
        edits: {
          at: now,
          byName: actor.name,
          note,
          fromStartedAt: shift.startedAt,
          fromEndedAt: shift.endedAt,
          toStartedAt: startedAt,
          toEndedAt: endedAt,
        },
      },
    },
    { returnDocument: "after" }
  )
    .select("-tenantId -__v")
    .lean();
  if (!updated) {
    throw new ServiceError(409, "La jornada cambió mientras la editabas. Recargá la página e intentá de nuevo.");
  }

  const iso = (d: Date | null) => (d ? d.toISOString() : "abierta");
  AccessLog.create({
    tenantId,
    tenantSlug: actor.tenantSlug,
    userEmail:  actor.email || actor.name,
    ip:         actor.ip ?? "unknown",
    userAgent:  actor.userAgent ?? "",
    success:    true,
    event:      "work_shift_adjust",
    path:       `workShiftId=${shiftId};staffName=${shift.staffName};startedAt=${iso(shift.startedAt)}->${iso(startedAt)};endedAt=${iso(shift.endedAt)}->${iso(endedAt)};minutes=${minutes}`,
  }).catch(() => {});

  return updated;
}

interface MyShiftLean {
  _id: mongoose.Types.ObjectId;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
  status: "abierta" | "cerrada";
  closedBy: "staff" | "admin";
  edits?: unknown[];
}

/**
 * Las horas de la propia persona, para la app del teléfono: su jornada abierta, lo que lleva en la
 * quincena y en el mes en curso, y sus jornadas del mes agrupadas por día. Los minutos son solo de
 * jornadas cerradas; la app suma en vivo lo que corre de la abierta. Dice si una jornada fue
 * ajustada por el admin, pero no trae sus notas: son internas.
 */
export async function getMyHours(tenantId: string, staffUserId: string) {
  if (!mongoose.isValidObjectId(staffUserId)) throw new ServiceError(404, "Personal no encontrado");
  await connectToDatabase();

  const ref = nowInCR();
  const month = resolvePeriod("mes", ref);

  const [shifts, open] = await Promise.all([
    WorkShift.find({ tenantId, staffUserId, startedAt: { $gte: month.from, $lt: month.to } })
      .select("startedAt endedAt minutes status closedBy edits.at")
      .sort({ startedAt: 1 })
      .lean<MyShiftLean[]>(),
    WorkShift.findOne({ tenantId, staffUserId, status: "abierta" })
      .select("startedAt")
      .lean<{ _id: mongoose.Types.ObjectId; startedAt: Date } | null>(),
  ]);

  const closedMinutes = (list: MyShiftLean[]) =>
    list.reduce((sum, s) => sum + (s.status === "cerrada" ? s.minutes : 0), 0);

  const summary = (type: PeriodType) => {
    const { from, to } = resolvePeriod(type, ref);
    const inRange = shifts.filter((s) => s.startedAt >= from && s.startedAt < to);
    return { from, to, label: formatPeriodLabel(type, ref), minutes: closedMinutes(inRange), shiftsCount: inRange.length };
  };

  // Un turno que cruza la medianoche cuenta completo en el día en que empezó, igual que en la web.
  const byDay = new Map<string, MyShiftLean[]>();
  for (const s of shifts) {
    const key = crDayKey(s.startedAt);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      label: formatCRDayLabel(date),
      minutes: closedMinutes(list),
      shifts: list.map((s) => ({
        _id: String(s._id),
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        minutes: s.minutes,
        status: s.status,
        adjusted: s.closedBy === "admin" || (s.edits?.length ?? 0) > 0,
      })),
    }));

  return {
    openShift: open ? { _id: String(open._id), startedAt: open.startedAt } : null,
    quincena: summary("quincena"),
    mes: summary("mes"),
    days,
  };
}
