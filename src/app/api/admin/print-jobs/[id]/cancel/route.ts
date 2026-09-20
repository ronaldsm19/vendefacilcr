import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { PrintJob } from "@/models/PrintJob";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });

  const job = await PrintJob.findOne({ _id: id, tenantId: session.tenantId }).lean() as { status: string } | null;
  if (!job) return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
  if (job.status !== "pending") return NextResponse.json({ error: "Solo se pueden cancelar trabajos pendientes" }, { status: 409 });

  await PrintJob.updateOne(
    { _id: id, tenantId: session.tenantId },
    { $set: { status: "failed", lastError: "cancelado", claimedAt: null } }
  );

  return NextResponse.json({ ok: true, id, status: "failed" });
}
