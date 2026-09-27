import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashClose } from "@/models/CashClose";
import { CashSession } from "@/models/CashSession";
import { AccessLog } from "@/models/AccessLog";
import { getSession, requireFeature, requireRole } from "@/lib/auth";
import { buildArqueo, expectedCash } from "@/lib/cashCount";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { verifyAuthorizationPassword } from "@/server/services/authorizationPassword";
import mongoose from "mongoose";

interface CloseLean {
  _id: unknown;
  closeNumber?: number;
  openingAmount?: number;
  paymentBreakdown?: { efectivo?: number };
  withdrawalsTotal?: number;
  cashLeft?: number;
}

/**
 * Edita un cierre ya hecho, de hoy o de otro día: el conteo del arqueo, lo que quedó en caja y las
 * notas. Solo el admin y con la contraseña de eliminación. El arqueo llega como cantidades por
 * denominación y el servidor lo recalcula con lo guardado en el cierre (caja inicial + efectivo
 * vendido − retiros), nunca con totales de la pantalla.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "cierre-de-caja") ?? requireRole(session, "admin");
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const { arqueo, cashLeft, notes, password } = body as Record<string, unknown>;

  const existing = await CashClose.findOne({ _id: id, tenantId: session.tenantId })
    .select("closeNumber openingAmount paymentBreakdown withdrawalsTotal cashLeft")
    .lean() as CloseLean | null;
  if (!existing) return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (arqueo !== undefined) {
    const built = buildArqueo((arqueo as { denominaciones?: unknown } | null)?.denominaciones, expectedCash(existing));
    if (!built) return NextResponse.json({ error: "El conteo del arqueo no es válido" }, { status: 400 });
    update.arqueo = built;
  }
  if (cashLeft !== undefined) {
    if (typeof cashLeft !== "number" || !Number.isFinite(cashLeft) || cashLeft < 0) {
      return NextResponse.json({ error: "El monto que quedó en caja no es válido" }, { status: 400 });
    }
    update.cashLeft = cashLeft;
  }
  if (notes !== undefined) update.notes = String(notes);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 });
  }

  // Lo que quedó en caja es la caja inicial de la próxima apertura, que la lee de la sesión de este
  // cierre. Si ya se volvió a abrir la caja, ese monto ya se usó y cambiarlo acá no la corrige.
  const cashLeftChanged = update.cashLeft !== undefined && update.cashLeft !== (existing.cashLeft ?? 0);
  const closedSession = cashLeftChanged
    ? await CashSession.findOne({ tenantId: session.tenantId, closeId: id })
        .lean() as { _id: unknown; openedAt: Date } | null
    : null;
  if (closedSession) {
    const reopened = await CashSession.exists({
      tenantId: session.tenantId,
      _id: { $ne: closedSession._id },
      openedAt: { $gt: closedSession.openedAt },
    });
    if (reopened) {
      return NextResponse.json(
        { error: "Después de este cierre ya se volvió a abrir la caja; lo que quedó en caja ya no se puede cambiar." },
        { status: 409 }
      );
    }
  }

  let tenant: { slug: string };
  try {
    tenant = await verifyAuthorizationPassword(session, password, "editar cierres de caja");
  } catch (err) {
    return serviceErrorResponse(err);
  }

  const updated = await CashClose.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!updated) return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });

  if (closedSession) {
    await CashSession.updateOne({ _id: closedSession._id }, { $set: { cashLeft: update.cashLeft } });
  }

  AccessLog.create({
    tenantId:   session.tenantId,
    tenantSlug: tenant.slug || session.tenantSlug,
    userEmail:  session.email || session.name,
    ip:         request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    userAgent:  request.headers.get("user-agent") ?? "",
    success:    true,
    event:      "cash_close_edit",
    path:       `closeId=${id};closeNumber=${existing.closeNumber ?? ""};cambios=${Object.keys(update).join(",")}`,
  }).catch(() => {});

  return NextResponse.json({ cashClose: updated });
}
