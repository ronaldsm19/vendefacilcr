import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda } from "@/models/Comanda";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";

/** Marca como "servida" TODAS las comandas "enviada" de una mesa, de una sola vez. */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const body = await request.json().catch(() => ({}));
  const { tableId } = body as { tableId?: unknown };
  if (typeof tableId !== "string" || !mongoose.isValidObjectId(tableId)) {
    return NextResponse.json({ error: "Falta tableId" }, { status: 400 });
  }

  const result = await Comanda.updateMany(
    { tenantId: session.tenantId, tableId, status: "enviada" },
    { $set: { status: "servida", servedAt: new Date(), servedBy: session.name } }
  );

  return NextResponse.json({ ok: true, updated: result.modifiedCount });
}
