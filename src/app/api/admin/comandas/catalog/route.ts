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
  // Los de precio libre solo van a quien sabe pedir el precio de la pieza (la web manda
  // ?precioLibre=1). La app de meseros todavía no: si los recibiera, los comandaría sin precio.
  const withOpenPrice = request.nextUrl.searchParams.get("precioLibre") === "1";
  const raw = await Product.find({
    tenantId: session.tenantId,
    available: true,
    ...(withOpenPrice ? {} : { soldBy: { $ne: "libre" } }),
  })
    .select("name price category station menuSection image extras soldBy")
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
    // "kg": el precio es por kilo y al comandar hay que mandar weightKg (peso de la pieza).
    // "libre": hay que mandar unitPrice (precio de la pieza); price es solo el sugerido.
    soldBy: p.soldBy === "kg" || p.soldBy === "libre" ? p.soldBy : "unidad",
  }));

  return NextResponse.json({ products });
}
