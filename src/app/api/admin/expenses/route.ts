import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Expense } from "@/models/Expense";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const expenses = await Expense.find({ tenantId: session.tenantId }).sort({ date: -1 }).lean();
  return NextResponse.json({ expenses });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const { title, items, date, category, receiptImage, notes } = body;

  if (!title || !items?.length) {
    return NextResponse.json({ error: "Título e items son requeridos" }, { status: 400 });
  }

  const total = items.reduce(
    (sum: number, item: { amount: number }) => sum + Number(item.amount),
    0
  );

  const expense = await Expense.create({
    tenantId: session.tenantId,
    title, items, total,
    date: date ? new Date(date) : new Date(),
    category: category ?? "materia_prima",
    receiptImage, notes,
  });

  return NextResponse.json({ expense }, { status: 201 });
}
