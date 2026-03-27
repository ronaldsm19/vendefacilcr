import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Payment } from "@/models/Payment";
import { getSuperadminSession } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const { status, paidAt, notes } = await request.json();

  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (paidAt) update.paidAt = new Date(paidAt);
  if (status === "paid" && !paidAt) update.paidAt = new Date();
  if (notes !== undefined) update.notes = notes;

  const payment = await Payment.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ payment });
}
