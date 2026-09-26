import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { StaffUser, type StaffRole } from "@/models/StaffUser";
import { WorkShift } from "@/models/WorkShift";
import { PayrollPayment } from "@/models/PayrollPayment";
import { computeServiceReport } from "@/server/services/serviceReport";
import { ServiceError } from "@/server/errors";
import { signPrivateUrl } from "@/lib/supabase";
import {
  MAX_PAY_RATE,
  PAY_LINE_KINDS,
  PAY_METHODS,
  amountForPay,
  isNegativeKind,
  readStaffPay,
  totalOfLines,
  type PayLine,
  type PayLineKind,
  type PayMethod,
  type PaymentView,
  type PayrollOverview,
  type PayrollRow,
  type StaffPay,
  type StaffPayrollDetailData,
  type UnpaidShift,
} from "@/lib/payroll";
import type { PeriodRange } from "@/lib/workPeriod";

/**
 * Planilla: cuánto se le debe a cada persona según las horas que marcó, qué ya se le pagó y
 * qué queda pendiente.
 *
 * Control interno de pagos, NO una planilla legal: no calcula CCSS, no liquida aguinaldo ni
 * vacaciones y no produce ningún documento tributario.
 *
 * Todo el dinero en colones enteros. Nada de decimales: un céntimo perdido en una división se
 * convierte en una discusión con la empleada.
 */

/** Día calendario de Costa Rica (UTC−6 fijo) de un instante, como YYYY-MM-DD. */
export function crDayKey(d: Date): string {
  const cr = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  const y = cr.getUTCFullYear();
  const m = String(cr.getUTCMonth() + 1).padStart(2, "0");
  const day = String(cr.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toShiftView(s: { _id: mongoose.Types.ObjectId; startedAt: Date; endedAt: Date | null; minutes: number }): UnpaidShift {
  return {
    _id: String(s._id),
    startedAt: s.startedAt.toISOString(),
    endedAt: (s.endedAt ?? s.startedAt).toISOString(),
    minutes: s.minutes,
    day: crDayKey(s.startedAt),
  };
}

/**
 * Un pago tal como lo ve la pantalla. Los enlaces firmados se agregan aparte con
 * `withSignedLinks`, porque firmar es una llamada a Supabase y no vale la pena hacerla en un
 * listado donde nadie va a abrir los archivos.
 */
function toPaymentView(p: Record<string, unknown>): PaymentView {
  const basis = (p.basis ?? {}) as PaymentView["basis"];
  return {
    _id: String(p._id),
    staffUserId: String(p.staffUserId),
    staffName: String(p.staffName ?? ""),
    staffRole: String(p.staffRole ?? ""),
    basis: { mode: basis.mode, rate: basis.rate ?? 0, minutes: basis.minutes ?? 0, days: basis.days ?? 0 },
    periodFrom: (p.periodFrom as Date).toISOString(),
    periodTo: (p.periodTo as Date).toISOString(),
    lines: (p.lines ?? []) as PayLine[],
    total: Number(p.total ?? 0),
    method: p.method as PayMethod,
    reference: String(p.reference ?? ""),
    proofImage: String(p.proofImage ?? ""),
    receiptPath: String(p.receiptPath ?? ""),
    proofUrl: null,
    receiptUrl: null,
    paidAt: (p.paidAt as Date).toISOString(),
    createdByName: String(p.createdByName ?? ""),
    notes: String(p.notes ?? ""),
    voidedAt: p.voidedAt ? (p.voidedAt as Date).toISOString() : null,
    voidedByName: String(p.voidedByName ?? ""),
    voidReason: String(p.voidReason ?? ""),
  };
}

/** Agrega los enlaces firmados a un pago. Se firma solo lo que existe. */
async function withSignedLinks(view: PaymentView): Promise<PaymentView> {
  const [proofUrl, receiptUrl] = await Promise.all([
    signPrivateUrl(view.proofImage),
    signPrivateUrl(view.receiptPath),
  ]);
  return { ...view, proofUrl, receiptUrl };
}

// ── Resumen ───────────────────────────────────────────────────────────────────

interface UnpaidBucket {
  minutes: number;
  days: Set<string>;
}

/**
 * Resumen de la planilla del período.
 *
 * Mezcla dos ventanas de tiempo a propósito: las horas del PERÍODO, que es lo que la dueña
 * está mirando, y lo que se debe de TODO el tiempo, que es lo que de verdad tiene que pagar.
 * Si solo se mirara el período, una quincena vieja sin pagar desaparecería de la vista.
 */
export async function getPayrollOverview(tenantId: string, range: PeriodRange): Promise<PayrollOverview> {
  await connectToDatabase();
  const tenantOid = new mongoose.Types.ObjectId(tenantId);

  const [staff, periodRows, unpaidShifts, payments] = await Promise.all([
    StaffUser.find({ tenantId, active: true })
      .select("name role pay phone")
      .sort({ name: 1 })
      .lean<{ _id: mongoose.Types.ObjectId; name: string; role: StaffRole; pay?: unknown; phone?: string }[]>(),
    WorkShift.aggregate<{ _id: mongoose.Types.ObjectId; minutes: number; openCount: number }>([
      { $match: { tenantId: tenantOid, startedAt: { $gte: range.from, $lt: range.to } } },
      {
        $group: {
          _id: "$staffUserId",
          minutes: { $sum: { $cond: [{ $eq: ["$status", "cerrada"] }, "$minutes", 0] } },
          openCount: { $sum: { $cond: [{ $eq: ["$status", "abierta"] }, 1, 0] } },
        },
      },
    ]),
    // Sin filtro de fecha: lo que se debe se debe, haya sido cuando haya sido.
    WorkShift.find({ tenantId, status: "cerrada", payrollPaymentId: null })
      .select("staffUserId minutes startedAt")
      .lean<{ staffUserId: mongoose.Types.ObjectId; minutes: number; startedAt: Date }[]>(),
    PayrollPayment.find({ tenantId, voidedAt: null })
      .select("staffUserId total paidAt")
      .sort({ paidAt: -1 })
      .lean<{ _id: mongoose.Types.ObjectId; staffUserId: mongoose.Types.ObjectId; total: number; paidAt: Date }[]>(),
  ]);

  const unpaidByStaff = new Map<string, UnpaidBucket>();
  for (const s of unpaidShifts) {
    const key = String(s.staffUserId);
    const bucket = unpaidByStaff.get(key) ?? { minutes: 0, days: new Set<string>() };
    bucket.minutes += s.minutes;
    bucket.days.add(crDayKey(s.startedAt));
    unpaidByStaff.set(key, bucket);
  }

  const periodByStaff = new Map(periodRows.map((r) => [String(r._id), r]));
  const lastByStaff = new Map<string, { _id: string; paidAt: string; total: number }>();
  let paidInPeriod = 0;
  for (const p of payments) {
    const key = String(p.staffUserId);
    if (!lastByStaff.has(key)) {
      lastByStaff.set(key, { _id: String(p._id), paidAt: p.paidAt.toISOString(), total: p.total });
    }
    if (p.paidAt >= range.from && p.paidAt < range.to) paidInPeriod += p.total;
  }

  const rows: PayrollRow[] = staff.map((s) => {
    const key = String(s._id);
    const pay = readStaffPay(s.pay);
    const bucket = unpaidByStaff.get(key);
    const unpaidMinutes = bucket?.minutes ?? 0;
    const unpaidDays = bucket?.days.size ?? 0;
    const period = periodByStaff.get(key);
    return {
      staffUserId: key,
      name: s.name,
      role: s.role,
      phone: s.phone ?? "",
      pay,
      periodMinutes: period?.minutes ?? 0,
      unpaidMinutes,
      unpaidDays,
      // Un fijo quincenal o mensual solo se debe si hay horas sin pagar; si no, es cero.
      dueAmount: unpaidMinutes > 0 ? amountForPay(pay, unpaidMinutes, unpaidDays) : 0,
      openShifts: period?.openCount ?? 0,
      lastPayment: lastByStaff.get(key) ?? null,
    };
  });

  return {
    rows,
    totals: {
      due: rows.reduce((s, r) => s + r.dueAmount, 0),
      unpaidMinutes: rows.reduce((s, r) => s + r.unpaidMinutes, 0),
      paidInPeriod,
    },
  };
}

// ── Detalle de una persona ────────────────────────────────────────────────────

export async function getStaffPayrollDetail(
  tenantId: string,
  staffUserId: string
): Promise<StaffPayrollDetailData> {
  if (!mongoose.isValidObjectId(staffUserId)) throw new ServiceError(404, "Empleado no encontrado");
  await connectToDatabase();

  const staff = await StaffUser.findOne({ _id: staffUserId, tenantId })
    .select("name role pay phone")
    .lean<{ _id: mongoose.Types.ObjectId; name: string; role: StaffRole; pay?: unknown; phone?: string } | null>();
  if (!staff) throw new ServiceError(404, "Empleado no encontrado");

  const [unpaid, payments] = await Promise.all([
    WorkShift.find({ tenantId, staffUserId, status: "cerrada", payrollPaymentId: null })
      .select("startedAt endedAt minutes")
      .sort({ startedAt: 1 })
      .lean<{ _id: mongoose.Types.ObjectId; startedAt: Date; endedAt: Date; minutes: number }[]>(),
    PayrollPayment.find({ tenantId, staffUserId }).sort({ paidAt: -1 }).limit(60).lean<Record<string, unknown>[]>(),
  ]);

  return {
    staff: {
      _id: String(staff._id),
      name: staff.name,
      role: staff.role,
      phone: staff.phone ?? "",
      pay: readStaffPay(staff.pay),
    },
    unpaidShifts: unpaid.map(toShiftView),
    // Se firman acá: es la pantalla donde la dueña ve las miniaturas y manda los comprobantes.
    payments: await Promise.all(payments.map((p) => withSignedLinks(toPaymentView(p)))),
  };
}

/** Un pago con los turnos que cubrió: lo que necesita el comprobante. */
export async function getPaymentWithShifts(tenantId: string, paymentId: string): Promise<PaymentView> {
  if (!mongoose.isValidObjectId(paymentId)) throw new ServiceError(404, "Pago no encontrado");
  await connectToDatabase();

  const payment = await PayrollPayment.findOne({ _id: paymentId, tenantId }).lean<Record<string, unknown> | null>();
  if (!payment) throw new ServiceError(404, "Pago no encontrado");

  const shifts = await WorkShift.find({ tenantId, payrollPaymentId: paymentId })
    .select("startedAt endedAt minutes")
    .sort({ startedAt: 1 })
    .lean<{ _id: mongoose.Types.ObjectId; startedAt: Date; endedAt: Date; minutes: number }[]>();

  const view = await withSignedLinks(toPaymentView(payment));
  return { ...view, shifts: shifts.map(toShiftView) };
}

// ── Tarifa ────────────────────────────────────────────────────────────────────

export async function saveStaffPay(
  tenantId: string,
  staffUserId: string,
  input: { pay: unknown; phone: unknown }
): Promise<{ pay: StaffPay; phone: string }> {
  if (!mongoose.isValidObjectId(staffUserId)) throw new ServiceError(404, "Empleado no encontrado");
  const pay = readStaffPay(input.pay);
  if (pay.rate > MAX_PAY_RATE) throw new ServiceError(400, "La tarifa es demasiado alta, revisala");
  const phone = String(input.phone ?? "").trim().slice(0, 30);

  await connectToDatabase();
  const updated = await StaffUser.findOneAndUpdate(
    { _id: staffUserId, tenantId },
    { $set: { pay, phone } },
    { new: true }
  )
    .select("pay phone")
    .lean<{ pay?: unknown; phone?: string } | null>();

  if (!updated) throw new ServiceError(404, "Empleado no encontrado");
  return { pay: readStaffPay(updated.pay), phone: updated.phone ?? "" };
}

// ── Registrar un pago ─────────────────────────────────────────────────────────

export interface CreatePaymentInput {
  staffUserId: string;
  shiftIds: string[];
  /** Solo las líneas que agregó la dueña: bonos, adelantos, deducciones. Las de horas y
   *  servicio las calcula el servidor con la tarifa guardada. */
  extraLines: { kind: PayLineKind; label: string; amount: number }[];
  method: PayMethod;
  reference: string;
  proofImage: string;
  paidAt: Date;
  notes: string;
  periodFrom: Date;
  periodTo: Date;
}

function sanitizeExtraLines(raw: CreatePaymentInput["extraLines"]): PayLine[] {
  if (!Array.isArray(raw)) return [];
  const out: PayLine[] = [];
  for (const l of raw.slice(0, 20)) {
    const kind = PAY_LINE_KINDS.includes(l?.kind) ? l.kind : null;
    if (!kind || kind === "horas" || kind === "servicio") {
      // Esas dos las pone el servidor; si llegan de afuera se ignoran.
      continue;
    }
    const amountRaw = Number(l?.amount);
    if (!Number.isFinite(amountRaw) || amountRaw === 0) continue;
    const magnitude = Math.round(Math.abs(amountRaw));
    if (magnitude > MAX_PAY_RATE) throw new ServiceError(400, "Hay un monto demasiado alto, revisalo");
    // El signo lo decide el concepto, no el cliente: un adelanto siempre resta.
    const amount = isNegativeKind(kind) ? -magnitude : magnitude;
    const label = String(l?.label ?? "").trim().slice(0, 80);
    out.push({ kind, label: label || kind, amount });
  }
  return out;
}

/**
 * Registra un pago y marca sus turnos como pagados.
 *
 * El orden importa: primero se estampan los turnos con un id reservado y SOLO si todos los
 * que se pidieron estaban libres; recién entonces se guarda el pago. Al revés quedaría un pago
 * sin turnos si alguien se adelantó. Y el estampado va condicionado a `payrollPaymentId: null`
 * porque dos administradores pagando a la vez, sin esa condición, pagan las mismas horas dos
 * veces.
 */
export async function createPayment(
  tenantId: string,
  input: CreatePaymentInput,
  actorName: string
): Promise<PaymentView> {
  if (!mongoose.isValidObjectId(input.staffUserId)) throw new ServiceError(404, "Empleado no encontrado");
  if (!PAY_METHODS.includes(input.method)) throw new ServiceError(400, "Método de pago inválido");

  const shiftIds = Array.from(new Set((input.shiftIds ?? []).filter((id) => mongoose.isValidObjectId(id))));
  if (shiftIds.length === 0) throw new ServiceError(400, "Elegí al menos un turno para pagar");

  await connectToDatabase();

  const staff = await StaffUser.findOne({ _id: input.staffUserId, tenantId })
    .select("name role pay")
    .lean<{ _id: mongoose.Types.ObjectId; name: string; role: StaffRole; pay?: unknown } | null>();
  if (!staff) throw new ServiceError(404, "Empleado no encontrado");

  const pay = readStaffPay(staff.pay);
  if (pay.rate <= 0) throw new ServiceError(400, "Ponele una tarifa antes de pagarle");

  // Los turnos tienen que ser de esta persona, de este negocio, cerrados y sin pagar.
  const shifts = await WorkShift.find({
    _id: { $in: shiftIds },
    tenantId,
    staffUserId: input.staffUserId,
    status: "cerrada",
    payrollPaymentId: null,
  })
    .select("startedAt endedAt minutes")
    .lean<{ _id: mongoose.Types.ObjectId; startedAt: Date; endedAt: Date; minutes: number }[]>();

  if (shifts.length !== shiftIds.length) {
    throw new ServiceError(409, "Algunos de esos turnos ya fueron pagados o cambiaron. Recargá la pantalla.");
  }

  const minutes = shifts.reduce((s, x) => s + x.minutes, 0);
  const days = new Set(shifts.map((x) => crDayKey(x.startedAt))).size;

  const lines: PayLine[] = [];
  const hoursAmount = amountForPay(pay, minutes, days);
  lines.push({ kind: "horas", label: "Horas trabajadas", amount: hoursAmount });

  if (pay.includesService) {
    const report = await computeServiceReport(tenantId, { from: input.periodFrom, to: input.periodTo });
    const mine = report.workers.find((w) => w.staffUserId === String(staff._id));
    if (mine && mine.amount > 0) {
      lines.push({ kind: "servicio", label: "10% de servicio del período", amount: mine.amount });
    }
  }

  lines.push(...sanitizeExtraLines(input.extraLines));

  const total = totalOfLines(lines);
  if (total < 0) {
    throw new ServiceError(400, "Los descuentos superan el monto a pagar. Revisá las líneas.");
  }

  const paymentId = new mongoose.Types.ObjectId();

  const stamped = await WorkShift.updateMany(
    {
      _id: { $in: shiftIds },
      tenantId,
      staffUserId: input.staffUserId,
      status: "cerrada",
      payrollPaymentId: null,
    },
    { $set: { payrollPaymentId: paymentId } }
  );

  if (stamped.modifiedCount !== shiftIds.length) {
    // Alguien pagó parte de esos turnos mientras armábamos este pago: se suelta lo estampado.
    await WorkShift.updateMany({ tenantId, payrollPaymentId: paymentId }, { $set: { payrollPaymentId: null } });
    throw new ServiceError(409, "Alguien pagó esas horas al mismo tiempo. Recargá la pantalla.");
  }

  try {
    await PayrollPayment.create({
      _id: paymentId,
      tenantId,
      staffUserId: staff._id,
      staffName: staff.name,
      staffRole: staff.role,
      basis: { mode: pay.mode, rate: pay.rate, minutes, days },
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      lines,
      total,
      method: input.method,
      reference: String(input.reference ?? "").trim().slice(0, 80),
      proofImage: String(input.proofImage ?? "").trim(),
      paidAt: input.paidAt,
      createdByName: actorName,
      notes: String(input.notes ?? "").trim().slice(0, 500),
    });
  } catch (err) {
    await WorkShift.updateMany({ tenantId, payrollPaymentId: paymentId }, { $set: { payrollPaymentId: null } });
    throw err;
  }

  return getPaymentWithShifts(tenantId, String(paymentId));
}

/**
 * Guarda la RUTA del comprobante ya subido al almacén privado, y devuelve un enlace firmado
 * recién hecho. Nunca se guarda el enlace: vence, y un enlace vencido guardado sería basura
 * que alguien tendría que salir a limpiar.
 */
export async function attachReceiptPdf(
  tenantId: string,
  paymentId: string,
  path: string
): Promise<{ receiptUrl: string | null }> {
  if (!mongoose.isValidObjectId(paymentId)) throw new ServiceError(404, "Pago no encontrado");
  await connectToDatabase();
  const clean = String(path ?? "").trim();
  const res = await PayrollPayment.updateOne({ _id: paymentId, tenantId }, { $set: { receiptPath: clean } });
  if (res.matchedCount === 0) throw new ServiceError(404, "Pago no encontrado");
  return { receiptUrl: await signPrivateUrl(clean) };
}

/**
 * Anula un pago y devuelve sus turnos al montón de lo que se debe.
 *
 * Nunca se borra: un registro de dinero que desaparece deja horas marcadas como pagadas que
 * nadie puede rastrear.
 */
export async function voidPayment(
  tenantId: string,
  paymentId: string,
  reason: string,
  actorName: string
): Promise<void> {
  if (!mongoose.isValidObjectId(paymentId)) throw new ServiceError(404, "Pago no encontrado");
  const trimmed = String(reason ?? "").trim();
  if (trimmed.length < 3) throw new ServiceError(400, "Escribí por qué se anula");

  await connectToDatabase();
  const res = await PayrollPayment.updateOne(
    { _id: paymentId, tenantId, voidedAt: null },
    { $set: { voidedAt: new Date(), voidedByName: actorName, voidReason: trimmed.slice(0, 200) } }
  );
  if (res.matchedCount === 0) throw new ServiceError(404, "Ese pago no existe o ya estaba anulado");

  await WorkShift.updateMany({ tenantId, payrollPaymentId: paymentId }, { $set: { payrollPaymentId: null } });
}

/** Historial de pagos del negocio dentro de un rango. */
export async function listPayments(
  tenantId: string,
  range: PeriodRange,
  staffUserId?: string
): Promise<PaymentView[]> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { tenantId, paidAt: { $gte: range.from, $lt: range.to } };
  if (staffUserId && mongoose.isValidObjectId(staffUserId)) filter.staffUserId = staffUserId;
  const payments = await PayrollPayment.find(filter).sort({ paidAt: -1 }).limit(200).lean<Record<string, unknown>[]>();
  return payments.map(toPaymentView);
}
