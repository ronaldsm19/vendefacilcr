import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonTable } from "@/models/SalonTable";
import { TableArea } from "@/models/TableArea";
import { Comanda } from "@/models/Comanda";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const [rawTables, areas] = await Promise.all([
    SalonTable.find({ tenantId: session.tenantId }).select("label areaId").lean(),
    TableArea.find({ tenantId: session.tenantId }).select("name").lean(),
  ]);
  const areaNameById = new Map(areas.map((a) => [String(a._id), a.name]));
  const tables = rawTables
    .map((t) => ({ _id: String(t._id), label: t.label, areaName: areaNameById.get(String(t.areaId)) ?? "" }))
    .sort((a, b) => {
      const byArea = a.areaName.localeCompare(b.areaName);
      if (byArea !== 0) return byArea;
      const n1 = Number(a.label), n2 = Number(b.label);
      if (!isNaN(n1) && !isNaN(n2)) return n1 - n2;
      return a.label.localeCompare(b.label);
    });

  let waiters: { waiterId: string; waiterName: string }[] = [];
  if (session.role !== "mesero") {
    const oid = new mongoose.Types.ObjectId(session.tenantId);
    const rows = await Comanda.aggregate([
      { $match: { tenantId: oid } },
      { $group: { _id: "$waiterId", waiterName: { $last: "$waiterName" } } },
      { $sort: { waiterName: 1 } },
    ]);
    waiters = rows.map((r) => ({ waiterId: String(r._id), waiterName: r.waiterName }));
  }

  return NextResponse.json({ tables, waiters });
}
