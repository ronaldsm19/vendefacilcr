import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda } from "@/models/Comanda";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await Comanda.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId, status: "enviada" },
    { $set: { status: "servida", servedAt: new Date(), servedBy: session.name } },
    { new: true }
  ).lean();

  if (!updated) {
    const exists = await Comanda.exists({ _id: id, tenantId: session.tenantId });
    if (!exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ error: "Solo se puede marcar servida una comanda enviada" }, { status: 409 });
  }

  return NextResponse.json({ comanda: updated });
}
