import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { effectiveStation } from "@/lib/station";
import { normalizeExtras } from "@/lib/pricing";
import { ensureExtrasMigrated } from "@/server/services/productExtras";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  await ensureExtrasMigrated(session.tenantId);
  const raw = await Product.find({ tenantId: session.tenantId, available: true })
    .select("name price category station menuSection image extras")
    .sort({ category: 1, name: 1 })
    .lean() as Array<Record<string, unknown>>;

  const products = raw.map((p) => ({
    _id: String(p._id),
    name: p.name,
    price: p.price,
    category: p.category,
    station: effectiveStation(p as { station?: string; menuSection?: string }),
    image: p.image ?? "",
    extras: normalizeExtras(p.extras) ?? [],
  }));

  return NextResponse.json({ products });
}
