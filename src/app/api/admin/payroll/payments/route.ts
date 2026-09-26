import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { parseDateRange } from "@/server/services/workShifts";
import { createPayment, crDayKey, listPayments } from "@/server/services/payroll";
import { ServiceError } from "@/server/errors";

// Pagos al personal. Crear un pago marca los turnos que cubre: ver createPayment.

async function guard(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return { error: deniedRole };
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return { error: deniedPlan };
  return { session };
}

export async function GET(request: NextRequest) {
  const { session, error } = await guard(request);
  if (error || !session) return error!;

  const { searchParams } = new URL(request.url);
  try {
    const range = parseDateRange(searchParams.get("from"), searchParams.get("to"));
    const staffUserId = searchParams.get("staffUserId") ?? undefined;
    return NextResponse.json({ payments: await listPayments(session.tenantId, range, staffUserId) });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}

/** Fecha que llega del cliente; sin dato o con basura, ahora. Nunca en el futuro. */
function readDate(raw: unknown, fallback: Date): Date {
  const d = raw ? new Date(String(raw)) : null;
  if (!d || Number.isNaN(d.getTime())) return fallback;
  return d;
}

export async function POST(request: NextRequest) {
  const { session, error } = await guard(request);
  if (error || !session) return error!;

  const body = await request.json().catch(() => ({}));
  const now = new Date();

  try {
    const paidAt = readDate(body.paidAt, now);
    // Se compara por DÍA de Costa Rica, no por instante: pagar "hoy" a las nueve de la mañana
    // manda un instante que, en horas UTC, puede caer más adelante que el reloj del servidor.
    if (crDayKey(paidAt) > crDayKey(now)) {
      throw new ServiceError(400, "La fecha del pago no puede estar en el futuro");
    }
    const periodFrom = readDate(body.periodFrom, now);
    const periodTo = readDate(body.periodTo, now);
    if (periodTo <= periodFrom) throw new ServiceError(400, "El período del pago es inválido");

    const payment = await createPayment(
      session.tenantId,
      {
        staffUserId: String(body.staffUserId ?? ""),
        shiftIds: Array.isArray(body.shiftIds) ? body.shiftIds.map(String) : [],
        extraLines: Array.isArray(body.extraLines) ? body.extraLines : [],
        method: body.method,
        reference: body.reference,
        proofImage: body.proofImage,
        paidAt,
        notes: body.notes,
        periodFrom,
        periodTo,
      },
      session.name
    );
    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
