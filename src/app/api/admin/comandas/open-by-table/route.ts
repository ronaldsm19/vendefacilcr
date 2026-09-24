import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { Comanda, type IComandaItem } from "@/models/Comanda";
import { SalonTable } from "@/models/SalonTable";
import { TableArea } from "@/models/TableArea";
import { Tenant } from "@/models/Tenant";
import { readComandaConfig } from "@/lib/comandaConfig";
import { syncTableWithComandas } from "@/lib/tableSync";
import { startOfTodayCR } from "@/lib/crDate";
import { subtotalOf } from "@/lib/pricing";

const OPEN_STATUSES = ["enviada", "servida"] as const;

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const tableIdFilter = request.nextUrl.searchParams.get("tableId");
  const todayStart = startOfTodayCR();
  const now = new Date();

  const comandas = await Comanda.find({
    tenantId: session.tenantId,
    status: { $in: OPEN_STATUSES },
    ...(tableIdFilter ? { tableId: tableIdFilter } : {}),
  }).sort({ sentAt: 1 }).lean();

  // Auto-reparación: comandas que quedaron a medio cerrar en una venta anterior
  // (todos los ítems ya sin pendiente pero el status nunca pasó a "pagada").
  const repairedTableIds = new Set<string>();
  const usable: typeof comandas = [];
  for (const c of comandas) {
    const allPaid = c.items.every((i: IComandaItem) => i.quantity - i.paidQty <= 0);
    if (allPaid) {
      await Comanda.updateOne(
        { _id: c._id, tenantId: session.tenantId, status: { $in: OPEN_STATUSES } },
        { $set: { status: "pagada", paidAt: new Date() } }
      );
      repairedTableIds.add(String(c.tableId));
      console.warn(`[open-by-table] comanda #${c.number} reparada`);
      continue;
    }
    usable.push(c);
  }
  for (const tid of repairedTableIds) {
    await syncTableWithComandas(session.tenantId, tid);
  }

  const tableIds = Array.from(new Set(usable.map((c) => String(c.tableId))));
  const [tables, tenant] = await Promise.all([
    SalonTable.find({ _id: { $in: tableIds }, tenantId: session.tenantId }).lean(),
    Tenant.findById(session.tenantId).select("comandaConfig").lean() as Promise<{ comandaConfig?: { warnMinutes?: number; alertMinutes?: number } } | null>,
  ]);
  const tableById = new Map(tables.map((t) => [String(t._id), t]));
  const areaIds = Array.from(new Set(tables.map((t) => String(t.areaId))));
  const areas = areaIds.length > 0 ? await TableArea.find({ _id: { $in: areaIds }, tenantId: session.tenantId }).lean() : [];
  const areaById = new Map(areas.map((a) => [String(a._id), a]));
  const multiArea = await TableArea.countDocuments({ tenantId: session.tenantId }) > 1;
  const { warnMinutes, alertMinutes } = readComandaConfig(tenant?.comandaConfig);

  const groups = new Map<string, typeof usable>();
  for (const c of usable) {
    const key = String(c.tableId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const resultTables = Array.from(groups.entries()).map(([tableId, group]) => {
    const table = tableById.get(tableId);
    const area = table ? areaById.get(String(table.areaId)) : undefined;
    const first = group[0];

    const outComandas = group.map((c) => {
      const items = (c.items as IComandaItem[]).map((it, index) => {
        const pendingQty = Math.max(0, it.quantity - it.paidQty);
        return {
          index,
          productId: it.productId,
          productName: it.productName,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          paidQty: it.paidQty,
          pendingQty,
          note: it.note ?? "",
          station: it.station,
          extras: it.extras ?? [],
        };
      });
      // Lo pendiente de cada línea lleva sus extras: la parte que falta cobrar se cobra completa.
      const pendingTotal = subtotalOf(items.map((it) => ({ unitPrice: it.unitPrice, extras: it.extras, quantity: it.pendingQty })));
      return {
        _id: String(c._id),
        number: c.number,
        status: c.status,
        version: c.version,
        customerName: c.customerName ?? "",
        waiterName: c.waiterName,
        sentAt: c.sentAt,
        servedAt: c.servedAt ?? null,
        notes: c.notes ?? "",
        isPrevious: new Date(c.sentAt) < todayStart,
        pendingTotal,
        items,
      };
    });

    const openCount = outComandas.length;
    const pendingTotal = outComandas.reduce((s, c) => s + c.pendingTotal, 0);
    const oldestSentAt = group[0].sentAt;
    const minutes = Math.floor((now.getTime() - new Date(oldestSentAt).getTime()) / 60000);

    return {
      tableId,
      tableLabel: table?.label ?? first.tableLabel,
      tableShape: table?.shape ?? "square",
      areaId: table ? String(table.areaId) : String(first.areaId),
      areaName: area?.name ?? first.areaName ?? "",
      tableStatus: table?.status ?? null,
      openCount,
      pendingTotal,
      oldestSentAt,
      minutes,
      comandas: outComandas,
    };
  });

  resultTables.sort((a, b) => new Date(a.oldestSentAt).getTime() - new Date(b.oldestSentAt).getTime());

  return NextResponse.json({
    todayStart: todayStart.toISOString(),
    multiArea,
    warnMinutes,
    alertMinutes,
    tables: resultTables,
  });
}
