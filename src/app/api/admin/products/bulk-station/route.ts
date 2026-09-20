import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { isStation } from "@/lib/station";

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  await connectToDatabase();
  const body = await request.json();
  const { category, ids, station } = body;

  if (!isStation(station)) {
    return NextResponse.json({ error: "Estación inválida" }, { status: 400 });
  }
  if (!category && !Array.isArray(ids)) {
    return NextResponse.json({ error: "Indicá una categoría o una lista de productos" }, { status: 400 });
  }

  const filter = category
    ? { tenantId: session.tenantId, category }
    : { tenantId: session.tenantId, _id: { $in: ids } };

  const result = await Product.updateMany(filter, { $set: { station } });
  return NextResponse.json({ ok: true, modified: result.modifiedCount ?? 0 });
}
