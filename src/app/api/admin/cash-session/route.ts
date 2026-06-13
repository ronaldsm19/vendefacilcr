import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashSession } from "@/models/CashSession";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const open = await CashSession.findOne({ tenantId: session.tenantId, status: "open" }).lean();

  let previousCashLeft: number | null = null;
  if (!open) {
    const last = await CashSession.findOne({ tenantId: session.tenantId, status: "closed" })
      .sort({ closedAt: -1 })
      .lean() as { cashLeft?: number } | null;
    previousCashLeft = last ? (last.cashLeft ?? 0) : null;
  }

  return NextResponse.json({ open, previousCashLeft });
}
