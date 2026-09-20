import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
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

  const tenant = await Tenant.findById(session.tenantId).select("comandaConfig.nextNumber").lean() as
    | { comandaConfig?: { nextNumber?: number } }
    | null;

  return NextResponse.json({ nextNumber: tenant?.comandaConfig?.nextNumber ?? 1 });
}
