import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { Tenant } from "@/models/Tenant";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const tenant = await Tenant.findById(session.tenantId)
    .select("+printAgentToken printAgentLastSeenAt")
    .lean() as { printAgentToken?: string; printAgentLastSeenAt?: Date | null } | null;

  return NextResponse.json({
    token: tenant?.printAgentToken ?? "",
    lastSeenAt: tenant?.printAgentLastSeenAt ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const token = randomBytes(32).toString("hex");
  await Tenant.findByIdAndUpdate(session.tenantId, { $set: { printAgentToken: token } });

  return NextResponse.json({ token });
}
