import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashSession } from "@/models/CashSession";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  const existing = await CashSession.findOne({ tenantId: session.tenantId, status: "open" });
  if (existing) {
    return NextResponse.json({ error: "Ya hay una caja abierta" }, { status: 409 });
  }

  const openingAmount = Math.max(0, Number(body.openingAmount) || 0);
  const countedAmount = body.countedAmount != null ? Math.max(0, Number(body.countedAmount) || 0) : undefined;

  const last = await CashSession.findOne({ tenantId: session.tenantId, status: "closed" })
    .sort({ closedAt: -1 })
    .lean() as { cashLeft?: number } | null;
  const previousCashLeft = last ? (last.cashLeft ?? 0) : undefined;

  const cashSession = await CashSession.create({
    tenantId: session.tenantId,
    status: "open",
    openedAt: new Date(),
    openingAmount,
    previousCashLeft,
    countedAmount,
    openingDifference: countedAmount != null ? countedAmount - openingAmount : undefined,
    withdrawals: [],
  });

  return NextResponse.json({ session: cashSession }, { status: 201 });
}
