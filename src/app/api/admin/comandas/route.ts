import { NextRequest, NextResponse, after } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Comanda } from "@/models/Comanda";
import { SalonTable } from "@/models/SalonTable";
import { TableArea } from "@/models/TableArea";
import { Tenant } from "@/models/Tenant";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { buildStatusUpdate, type ComandaStatus } from "@/lib/tableStatus";
import { startOfTodayCR } from "@/lib/crDate";
import { enqueueComandaPrint } from "@/lib/printQueue";
import { withKitchenNotes } from "@/lib/kitchenText";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { snapshotComandaItems, validateComandaItemsInput } from "@/server/services/comandaItems";

const OPEN_STATUSES: ComandaStatus[] = ["enviada", "servida"];
const ALL_STATUSES: ComandaStatus[] = ["enviada", "servida", "pagada", "anulada"];

function isComandaStatus(v: string): v is ComandaStatus {
  return (ALL_STATUSES as string[]).includes(v);
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { searchParams } = request.nextUrl;
  const pending = searchParams.get("pending") === "1";

  if (pending) {
    const deniedPending = requireRole(session, "admin", "cajero");
    if (deniedPending) return deniedPending;
  }

  const query: Record<string, unknown> = { tenantId: session.tenantId };
  const tableId = searchParams.get("tableId");
  const open = searchParams.get("open") === "1";
  const statusParam = searchParams.get("status");
  let statusList: ComandaStatus[] = [];

  if (pending) {
    query.status = { $in: OPEN_STATUSES };
    query.sentAt = { $lt: startOfTodayCR() };
  } else {
    if (open) {
      statusList = OPEN_STATUSES;
    } else if (statusParam) {
      const parts = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (!isComandaStatus(p)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
      statusList = parts as ComandaStatus[];
    }
    if (statusList.length > 0) query.status = { $in: statusList };

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) {
        const d = new Date(from);
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
        range.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
        range.$lte = d;
      }
      query.sentAt = range;
    }
    if (tableId) query.tableId = tableId;
  }

  let waiterId = searchParams.get("waiterId");
  if (session.role === "mesero" && !pending) {
    const openOnlyStatus = statusList.length > 0 && statusList.every((s) => s === "enviada" || s === "servida");
    const hasOpenTableAccess = !!tableId && (open || openOnlyStatus);
    if (!hasOpenTableAccess) {
      waiterId = session.userId;
    }
  }
  if (waiterId) query.waiterId = waiterId;

  let page = parseInt(searchParams.get("page") ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let limit = parseInt(searchParams.get("limit") ?? "30", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 30;
  if (limit > 100) limit = 100;

  const [comandas, total] = await Promise.all([
    Comanda.find(query).sort({ sentAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Comanda.countDocuments(query),
  ]);

  return NextResponse.json({ comandas, total, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const body = await request.json();
  const { tableId, customerName, items, notes } = body as {
    tableId?: unknown; customerName?: unknown; items?: unknown; notes?: unknown;
  };

  if (typeof tableId !== "string" || !mongoose.isValidObjectId(tableId)) {
    return NextResponse.json({ error: "Mesa requerida" }, { status: 400 });
  }
  try { validateComandaItemsInput(items); }
  catch (err) { return serviceErrorResponse(err); }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 500)) {
    return NextResponse.json({ error: "Las notas son muy largas (máx. 500)" }, { status: 400 });
  }
  if (customerName !== undefined && (typeof customerName !== "string" || customerName.length > 80)) {
    return NextResponse.json({ error: "El nombre del cliente es muy largo" }, { status: 400 });
  }

  const table = await SalonTable.findOne({ _id: tableId, tenantId: session.tenantId }).lean();
  if (!table) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  const area = await TableArea.findOne({ _id: table.areaId, tenantId: session.tenantId }).lean();

  let snapshotItems;
  try { snapshotItems = await snapshotComandaItems(session.tenantId, items); }
  catch (err) { return serviceErrorResponse(err); }

  // Backfill obligatorio (Fase 2, 5.1). Sin esto, en un tenant cuyo documento no tiene
  // comandaConfig.nextNumber, la 1ª y la 2ª comanda reciben ambas number = 1 (E11000).
  await Tenant.updateOne(
    { _id: session.tenantId, "comandaConfig.nextNumber": { $exists: false } },
    { $set: { "comandaConfig.nextNumber": 1 } }
  );
  const t = await Tenant.findByIdAndUpdate(
    session.tenantId,
    { $inc: { "comandaConfig.nextNumber": 1 } },
    { new: false }
  ).select("comandaConfig.nextNumber").lean() as { comandaConfig?: { nextNumber?: number } } | null;
  const number = t?.comandaConfig?.nextNumber ?? 1;

  const sentAt = new Date();
  let comanda;
  try {
    comanda = await Comanda.create({
      tenantId: session.tenantId,
      number,
      tableId,
      tableLabel: table.label,
      areaId: table.areaId,
      areaName: area?.name ?? "",
      customerName: typeof customerName === "string" ? customerName.trim() : "",
      waiterId: session.userId,
      waiterName: session.name,
      waiterRole: session.role,
      items: snapshotItems,
      notes: typeof notes === "string" ? notes.trim() : "",
      status: "enviada",
      version: 1,
      sentAt,
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Número de comanda duplicado, intentá de nuevo" }, { status: 409 });
    }
    throw err;
  }

  await SalonTable.updateOne(
    { _id: tableId, tenantId: session.tenantId, status: { $in: ["libre", "reservada"] } },
    { $set: buildStatusUpdate(table.status, "ocupada", { now: sentAt }) }
  );

  after(async () => {
    try { await enqueueComandaPrint(withKitchenNotes(comanda.toObject())); }
    catch (err) { console.error("[printQueue] comanda nueva", err); }
  });

  return NextResponse.json({ comanda }, { status: 201 });
}
