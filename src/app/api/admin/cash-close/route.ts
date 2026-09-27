import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashClose } from "@/models/CashClose";
import { CashSession } from "@/models/CashSession";
import { getSession, requireFeature } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
  const denied = requireFeature(session, "cierre-de-caja");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json();

  const { closeDate, salesTotal, paymentBreakdown,
          expensesTotal, profit, productsSummary, arqueo,
          openingAmount, withdrawals, withdrawalsTotal, cashLeft, salesList, notes } = body;

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
    ...(arqueo ? { arqueo } : {}),
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
