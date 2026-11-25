import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda, type IComandaItem } from "@/models/Comanda";
import { SalonTable } from "@/models/SalonTable";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { syncTableWithComandas } from "@/lib/tableSync";
import { hasPaidItems, paidUnits, planComandaEdit } from "@/lib/comandaEdit";
import { remapComandaClaims } from "@/server/services/comandaClaims";

/**
 * Anula una comanda abierta. Si ya tiene algo cobrado (cuenta dividida) no se puede anular entera:
 * se quita solo lo que falta por cobrar y la comanda se cierra como pagada con lo que sí se cobró.
 * Sirve para lo que se comandó por error y quedó "pegado" después de que la mesa pagó una parte.
 */
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
  const oldItems = comanda.items as IComandaItem[];
  const reasonText = typeof reason === "string" ? reason.trim() : "";
  const now = new Date();
  // Candado: si entre leer y guardar alguien cobró o se eliminó una venta, lo cobrado cambió.
  const guard = {
    _id: id, tenantId: session.tenantId, version: comanda.version,
    status: { $in: ["enviada", "servida"] },
    $expr: { $eq: [{ $sum: "$items.paidQty" }, paidUnits(oldItems)] },
  };

  let updated;
  if (hasPaidItems(oldItems)) {
    const plan = planComandaEdit<IComandaItem>(oldItems, []);
    updated = await Comanda.findOneAndUpdate(
      guard,
      {
        $set: {
          items: plan.items, status: "pagada", paidAt: now,
          // Queda anotado quién quitó lo pendiente y por qué, aunque la comanda cierre como pagada.
          cancelledAt: now, cancelledBy: session.name, cancelReason: reasonText || "Se quitó lo que faltaba por cobrar",
        },
        $inc: { version: 1 },
      },
      { new: true }
    ).lean();
    if (updated && plan.moved && (comanda.saleIds ?? []).length > 0) {
      try {
        await remapComandaClaims(session.tenantId, id, comanda.saleIds as string[], plan.indexMap);
      } catch (err) {
        console.error("[comandas cancel] No se pudieron actualizar las ventas de la comanda", err);
        await Comanda.updateOne(
          { _id: id, tenantId: session.tenantId, version: updated.version },
          { $set: { items: oldItems, status: comanda.status, paidAt: null, cancelledAt: null, cancelledBy: "", cancelReason: "" }, $inc: { version: 1 } }
        ).catch(() => {});
        return NextResponse.json({ error: "No se pudo quitar lo pendiente. Intentá de nuevo." }, { status: 500 });
      }
    }
  } else {
    updated = await Comanda.findOneAndUpdate(
      guard,
      { $set: { status: "anulada", cancelledAt: now, cancelledBy: session.name, cancelReason: reasonText } },
      { new: true }
    ).lean();
  }

  if (!updated) {
    return NextResponse.json({ error: "La comanda cambió mientras tanto (un cobro u otra edición). Recargá e intentá de nuevo." }, { status: 409 });
  }

  await syncTableWithComandas(session.tenantId, updated.tableId);
  const table = await SalonTable.findOne({ _id: updated.tableId, tenantId: session.tenantId }).lean();

  return NextResponse.json({ comanda: updated, table: table ?? null });
}
