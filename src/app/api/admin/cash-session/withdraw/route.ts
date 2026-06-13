import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashSession } from "@/models/CashSession";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  const amount = Number(body.amount);
  const leftAmount = Number(body.leftAmount);
  if (isNaN(amount) || amount <= 0 || isNaN(leftAmount) || leftAmount < 0) {
    return NextResponse.json({ error: "Montos inválidos" }, { status: 400 });
  }

  const cashSession = await CashSession.findOne({ tenantId: session.tenantId, status: "open" });
  if (!cashSession) {
    return NextResponse.json({ error: "No hay una caja abierta" }, { status: 404 });
  }

  cashSession.withdrawals.push({
    amount,
    leftAmount,
    note: body.note ? String(body.note) : "",
    date: new Date(),
  });
  await cashSession.save();

  return NextResponse.json({ session: cashSession });
}
