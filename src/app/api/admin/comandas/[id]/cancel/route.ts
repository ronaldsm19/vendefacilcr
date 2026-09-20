import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda, type IComandaItem } from "@/models/Comanda";
import { SalonTable } from "@/models/SalonTable";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { syncTableWithComandas } from "@/lib/tableSync";

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

  const body = await request.json().catch(() => ({}));
  const { reason } = body as { reason?: unknown };
  if (reason !== undefined && (typeof reason !== "string" || reason.length > 200)) {
    return NextResponse.json({ error: "La razón es muy larga (máx. 200)" }, { status: 400 });
  }

  const comanda = await Comanda.findOne({ _id: id, tenantId: session.tenantId }).lean();
  if (!comanda) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (comanda.status !== "enviada" && comanda.status !== "servida") {
    return NextResponse.json({ error: "La comanda ya no está abierta" }, { status: 409 });
  }
  if (comanda.items.some((i: IComandaItem) => i.paidQty > 0)) {
    return NextResponse.json({ error: "La comanda tiene ítems cobrados y no se puede anular" }, { status: 409 });
  }

  const updated = await Comanda.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId, status: { $in: ["enviada", "servida"] }, "items.paidQty": { $not: { $gt: 0 } } },
    { $set: { status: "anulada", cancelledAt: new Date(), cancelledBy: session.name, cancelReason: typeof reason === "string" ? reason.trim() : "" } },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: "La comanda ya no está abierta" }, { status: 409 });
  }

  await syncTableWithComandas(session.tenantId, updated.tableId);
  const table = await SalonTable.findOne({ _id: updated.tableId, tenantId: session.tenantId }).lean();

  return NextResponse.json({ comanda: updated, table: table ?? null });
}
