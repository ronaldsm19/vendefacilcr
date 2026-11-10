import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Expense } from "@/models/Expense";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "gastos");
  if (deniedPlan) return deniedPlan;
  const denied = requireFeature(session, "gastos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  // Recalcular total si se actualizan items
  if (body.items) {
    body.total = body.items.reduce(
      (sum: number, item: { amount: number }) => sum + Number(item.amount),
      0
    );
  }

  const expense = await Expense.findOneAndUpdate({ _id: id, tenantId: session.tenantId }, body, { new: true }).lean();
  if (!expense) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ expense });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "gastos");
  if (deniedPlan) return deniedPlan;
  const denied = requireFeature(session, "gastos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  await Expense.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
