import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { Comanda } from "@/models/Comanda";
import { enqueueComandaPrint } from "@/lib/printQueue";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Comanda no encontrada" }, { status: 404 });

  const comanda = await Comanda.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!comanda) return NextResponse.json({ error: "Comanda no encontrada" }, { status: 404 });
  if (comanda.status === "anulada") {
    return NextResponse.json({ error: "No se puede reimprimir una comanda anulada" }, { status: 409 });
  }

  try {
    const jobs = await enqueueComandaPrint(comanda, { isReprint: true });
    return NextResponse.json({ ok: true, jobs: jobs.map((j) => ({ id: String(j._id), station: j.station })) });
  } catch (err) {
    console.error("[POST /api/admin/comandas/[id]/reprint]", err);
    return NextResponse.json({ error: "No se pudo encolar la impresión" }, { status: 500 });
  }
}
