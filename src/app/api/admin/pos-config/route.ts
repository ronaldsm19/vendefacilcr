import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("posConfig").lean() as
    | { posConfig?: Record<string, unknown> }
    | null;

  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json({
    ivaEnabled:  (tenant.posConfig?.ivaEnabled  as boolean) ?? false,
    ivaRate:     (tenant.posConfig?.ivaRate      as number)  ?? 13,
    tipEnabled:  (tenant.posConfig?.tipEnabled   as boolean) ?? false,
    serviceRate: (tenant.posConfig?.serviceRate  as number)  ?? 10,
    tableCount:  (tenant.posConfig?.tableCount   as number)  ?? 0,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (body.ivaEnabled  !== undefined) update["posConfig.ivaEnabled"]  = Boolean(body.ivaEnabled);
  if (body.tipEnabled  !== undefined) update["posConfig.tipEnabled"]  = Boolean(body.tipEnabled);
  if (body.ivaRate !== undefined) {
    const rate = Number(body.ivaRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "ivaRate debe ser 0-100" }, { status: 400 });
    }
    update["posConfig.ivaRate"] = rate;
  }
  if (body.serviceRate !== undefined) {
    const rate = Number(body.serviceRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "serviceRate debe ser 0-100" }, { status: 400 });
    }
    update["posConfig.serviceRate"] = rate;
  }
  if (body.tableCount !== undefined) {
    const count = Math.max(0, Math.round(Number(body.tableCount)));
    if (isNaN(count)) return NextResponse.json({ error: "tableCount inválido" }, { status: 400 });
    update["posConfig.tableCount"] = count;
  }

  await Tenant.findByIdAndUpdate(session.tenantId, { $set: update });
  return NextResponse.json({ ok: true });
}
