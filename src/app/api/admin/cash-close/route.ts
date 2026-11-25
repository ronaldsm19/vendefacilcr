import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashClose } from "@/models/CashClose";
import { CashSession } from "@/models/CashSession";
import { Sale } from "@/models/Sale";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { dayRangeCR } from "@/lib/crDate";
import { splitPayments } from "@/lib/payments";
import { checkCardReconciliation, checkSinpeReconciliation } from "@/lib/cardReconciliation";
import { sectionsSummaryFromSales } from "@/server/services/sections";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "cierre-de-caja");
  if (deniedPlan) return deniedPlan;
  const denied = requireFeature(session, "cierre-de-caja");
  if (denied) return denied;

  await connectToDatabase();
  const closes = await CashClose.find({ tenantId: session.tenantId })
    .sort({ closeDate: -1 })
    .limit(30)
    .lean();
  return NextResponse.json({ closes });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "cierre-de-caja");
  if (deniedPlan) return deniedPlan;
  const denied = requireFeature(session, "cierre-de-caja");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json();

  const { closeDate, salesTotal, paymentBreakdown,
          expensesTotal, profit, productsSummary, arqueo,
          openingAmount, withdrawals, withdrawalsTotal, cashLeft, salesList, notes,
          cardReconciliation, sinpeReconciliation } = body;

  // Cuadre del datáfono. Lo esperado se recalcula de las ventas del día: si saliera del cuerpo de
  // la petición, mandar tarjeta en 0 sería suficiente para saltarse el control. Solo se exige
  // cuando hubo ventas con tarjeta; un día de puro efectivo y SINPE cierra como siempre.
  const { from, to } = dayRangeCR();
  const todaySales = await Sale.find({
    tenantId: session.tenantId,
    saleDate: { $gte: from, $lt: to },
  }).select("total paymentMethod mixedPayment items.productId items.lineTotal items.quantity").lean();
  const split = splitPayments(todaySales);
  const cardExpected = split.tarjeta;

  let cardCheck: ReturnType<typeof checkCardReconciliation> | null = null;
  if (cardExpected > 0) {
    cardCheck = checkCardReconciliation(cardExpected, cardReconciliation, session.name);
    if (!cardCheck.ok) {
      return NextResponse.json(
        { error: cardCheck.error, code: cardCheck.code, cardExpected },
        { status: 400 }
      );
    }
  }

  // Cuadre de SINPE contra el banco: opcional. Si no viene el total del banco, se cierra igual.
  const sinpeCheck = checkSinpeReconciliation(split.sinpe, sinpeReconciliation, session.name);
  if (!sinpeCheck.ok) {
    return NextResponse.json(
      { error: sinpeCheck.error, code: sinpeCheck.code, sinpeExpected: split.sinpe },
      { status: 400 }
    );
  }

  // La caja inicial sale de la caja abierta, no de la pantalla: si alguien la corrigió desde otro
  // equipo, la pantalla todavía calcula el arqueo con el monto viejo y el cierre quedaría mal.
  const open = await CashSession.findOne({ tenantId: session.tenantId, status: "open" })
    .lean() as { openingAmount: number; openingCorrections?: unknown[] } | null;
  if (open && openingAmount != null && Number(openingAmount) !== open.openingAmount) {
    return NextResponse.json(
      {
        error: "La caja inicial se corrigió desde otro equipo. Actualizá la pantalla y volvé a cerrar.",
        code: "OPENING_CHANGED",
      },
      { status: 409 }
    );
  }

  // Ventas por sección: se calculan aquí con las ventas del día (no de la pantalla) y quedan
  // guardadas en el cierre, así el historial no cambia si después se mueve una categoría.
  const sectionsSummary = await sectionsSummaryFromSales(session.tenantId, todaySales);

  const closeNumber = (await CashClose.countDocuments({ tenantId: session.tenantId })) + 1;

  const cashClose = await CashClose.create({
    tenantId: session.tenantId,
    closeDate: closeDate ? new Date(closeDate) : new Date(),
    closedBy:  session.name,
    closeNumber,
    salesTotal:       salesTotal       ?? 0,
    paymentBreakdown: paymentBreakdown ?? { efectivo: 0, sinpe: 0, tarjeta: 0 },
    expensesTotal:    expensesTotal    ?? 0,
    profit:           profit           ?? 0,
    productsSummary:  productsSummary  ?? [],
    sectionsSummary:  sectionsSummary  ?? [],
    ...(arqueo ? { arqueo } : {}),
    ...(cardCheck?.ok ? { cardReconciliation: cardCheck.value } : {}),
    ...(sinpeCheck.value ? { sinpeReconciliation: sinpeCheck.value } : {}),
    openingAmount:    open ? open.openingAmount : (openingAmount ?? 0),
    openingCorrections: open?.openingCorrections ?? [],
    withdrawals:      withdrawals      ?? [],
    withdrawalsTotal: withdrawalsTotal ?? 0,
    cashLeft:         cashLeft         ?? 0,
    salesList:        salesList        ?? [],
    notes:            notes            ?? "",
  });

  await CashSession.findOneAndUpdate(
    { tenantId: session.tenantId, status: "open" },
    { status: "closed", closedAt: new Date(), cashLeft: cashLeft ?? 0, closeId: cashClose._id }
  );

  return NextResponse.json({ cashClose }, { status: 201 });
}
