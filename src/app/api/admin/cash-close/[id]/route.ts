import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashClose } from "@/models/CashClose";
import { getSession } from "@/lib/auth";
import mongoose from "mongoose";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  await connectToDatabase();
  const body = await request.json();
  const { arqueo, cashLeft, notes } = body;

  const update: Record<string, unknown> = {};
  if (arqueo !== undefined) update.arqueo = arqueo;
  if (cashLeft !== undefined) update.cashLeft = Math.max(0, Number(cashLeft) || 0);
  if (notes !== undefined) update.notes = String(notes);

  const updated = await CashClose.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set: update },
    { new: true }
  );

  if (!updated) return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });

  return NextResponse.json({ cashClose: updated });
}
