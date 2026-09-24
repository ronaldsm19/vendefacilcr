import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { StaffUser, type StaffRole } from "@/models/StaffUser";
import { WorkShift } from "@/models/WorkShift";
import { AccessLog } from "@/models/AccessLog";
import { ServiceError } from "@/server/errors";
import { consumeAttempt, clearAttempts } from "@/server/services/rateLimit";
import type { PeriodRange } from "@/lib/workPeriod";

// Control de jornada laboral. La hora siempre es la del servidor: ninguna función de este módulo
// acepta un startedAt, un endedAt de marcaje ni minutos calculados afuera. La única excepción es
// closeShiftAsAdmin, que recibe la hora de salida real que elige el admin y la valida acá.

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
    .select("staffUserId startedAt")
    .lean<{ _id: { toString(): string }; staffUserId: { toString(): string }; startedAt: Date }[]>();

  const openByStaff = new Map(openShifts.map((s) => [s.staffUserId.toString(), s]));
  return staff.map((s) => {
    const open = openByStaff.get(s._id.toString());
    return {
      _id: s._id.toString(),
      name: s.name,
      role: s.role,
      openShift: open ? { _id: open._id.toString(), startedAt: open.startedAt } : null,
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
 * Única forma de corregir un turno que quedó abierto porque alguien olvidó marcar la salida. No hay
 * forma de editar startedAt, de tocar un turno ya cerrado ni de borrar turnos.
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
