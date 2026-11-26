import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonTable } from "@/models/SalonTable";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { isOwnArea } from "@/server/services/salonAreas";
import { buildStatusUpdate, isTableStatus } from "@/lib/tableStatus";
import { Comanda } from "@/models/Comanda";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "salon");
  if (deniedPlan) return deniedPlan;
  const denied = requireFeature(session, "salon:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  if (body.status !== undefined && !isTableStatus(body.status)) {
    return NextResponse.json({ error: "Estado de mesa inválido" }, { status: 400 });
  }

  const allowed = ["shape", "seats", "label", "x", "y", "statusNote", "areaId"];
  const $set: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) $set[key] = body[key];
  }
  if ($set.areaId !== undefined && !(await isOwnArea(session.tenantId, $set.areaId))) {
    return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
  }

  if (body.status !== undefined) {
    const current = await SalonTable.findOne({ _id: id, tenantId: session.tenantId }).lean();
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    // Una mesa con comandas abiertas está ocupada, aunque la gente ya se haya ido: liberarla a mano
    // dejaba la comanda "pegada" en una mesa que se veía libre. Primero se cobra o se quita lo pendiente.
    if (body.status !== "ocupada" && body.status !== current.status) {
      const open = await Comanda.countDocuments({
        tenantId: session.tenantId, tableId: id, status: { $in: ["enviada", "servida"] },
      });
      if (open > 0) {
        return NextResponse.json(
          {
            error: open === 1
              ? "Esta mesa tiene una comanda abierta. Cobrala, o quitale lo pendiente, antes de liberar la mesa."
              : `Esta mesa tiene ${open} comandas abiertas. Cobralas, o quitales lo pendiente, antes de liberar la mesa.`,
            code: "OPEN_COMANDAS",
          },
          { status: 409 }
        );
      }
    }
    Object.assign($set, buildStatusUpdate(current.status, body.status, {
      note: typeof body.statusNote === "string" ? body.statusNote : undefined,
      byName: session.name ?? "Administrador",
    }));
  }

  const table = await SalonTable.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set },
    { new: true }
  ).lean();
  if (!table) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ table });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedPlan = await requirePlan(session, "salon");
  if (deniedPlan) return deniedPlan;
  const denied = requireFeature(session, "salon:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();

  const table = await SalonTable.findOne({ _id: id, tenantId: session.tenantId });
  if (!table) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (table.status !== "libre") {
    return NextResponse.json({ error: "No se puede eliminar una mesa que no está libre" }, { status: 409 });
  }

  await SalonTable.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
