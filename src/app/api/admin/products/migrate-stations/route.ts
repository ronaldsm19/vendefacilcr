import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  await connectToDatabase();

  const bebidas = await Product.updateMany(
    { tenantId: session.tenantId, station: { $exists: false }, menuSection: "bebidas" },
    { $set: { station: "bebidas" } }
  );
  const cocina = await Product.updateMany(
    { tenantId: session.tenantId, station: { $exists: false } },
    { $set: { station: "cocina" } }
  );

  return NextResponse.json({
    ok: true,
    updated: { bebidas: bebidas.modifiedCount ?? 0, cocina: cocina.modifiedCount ?? 0 },
  });
}
