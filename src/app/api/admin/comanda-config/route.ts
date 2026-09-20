import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { readComandaConfig, COMANDA_MINUTES_MIN, COMANDA_MINUTES_MAX } from "@/lib/comandaConfig";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("comandaConfig").lean() as
    | { comandaConfig?: { warnMinutes?: number; alertMinutes?: number; nextNumber?: number } }
    | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  const { warnMinutes, alertMinutes } = readComandaConfig(tenant.comandaConfig);
  return NextResponse.json({
    warnMinutes,
    alertMinutes,
    nextNumber: tenant.comandaConfig?.nextNumber ?? 1,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  await connectToDatabase();
  const body = await request.json();

  const tenant = await Tenant.findById(session.tenantId).select("comandaConfig").lean() as
    | { comandaConfig?: { warnMinutes?: number; alertMinutes?: number } }
    | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  const current = readComandaConfig(tenant.comandaConfig);

  let warnMinutes = current.warnMinutes;
  if (body.warnMinutes !== undefined) {
    const n = Number(body.warnMinutes);
    if (!Number.isInteger(n) || n < COMANDA_MINUTES_MIN || n > COMANDA_MINUTES_MAX) {
      return NextResponse.json({ error: `warnMinutes debe ser un entero entre ${COMANDA_MINUTES_MIN} y ${COMANDA_MINUTES_MAX}` }, { status: 400 });
    }
    warnMinutes = n;
  }

  let alertMinutes = current.alertMinutes;
  if (body.alertMinutes !== undefined) {
    const n = Number(body.alertMinutes);
    if (!Number.isInteger(n) || n < COMANDA_MINUTES_MIN || n > COMANDA_MINUTES_MAX) {
      return NextResponse.json({ error: `alertMinutes debe ser un entero entre ${COMANDA_MINUTES_MIN} y ${COMANDA_MINUTES_MAX}` }, { status: 400 });
    }
    alertMinutes = n;
  }

  if (warnMinutes >= alertMinutes) {
    return NextResponse.json({ error: "warnMinutes debe ser menor que alertMinutes" }, { status: 400 });
  }

  await Tenant.updateOne(
    { _id: session.tenantId, "comandaConfig.nextNumber": { $exists: false } },
    { $set: { "comandaConfig.nextNumber": 1 } }
  );
  await Tenant.findByIdAndUpdate(session.tenantId, {
    $set: { "comandaConfig.warnMinutes": warnMinutes, "comandaConfig.alertMinutes": alertMinutes },
  });

  return NextResponse.json({ ok: true });
}
