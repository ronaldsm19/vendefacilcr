import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashClose } from "@/models/CashClose";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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

  await connectToDatabase();
  const body = await request.json();

  const { closeDate, closedBy, salesTotal, paymentBreakdown,
          expensesTotal, profit, productsSummary, arqueo } = body;

  const cashClose = await CashClose.create({
    tenantId: session.tenantId,
    closeDate: closeDate ? new Date(closeDate) : new Date(),
    closedBy:  closedBy ?? "",
    salesTotal:       salesTotal       ?? 0,
    paymentBreakdown: paymentBreakdown ?? { efectivo: 0, sinpe: 0, tarjeta: 0 },
    expensesTotal:    expensesTotal    ?? 0,
    profit:           profit           ?? 0,
    productsSummary:  productsSummary  ?? [],
    ...(arqueo ? { arqueo } : {}),
  });

  return NextResponse.json({ cashClose }, { status: 201 });
}
