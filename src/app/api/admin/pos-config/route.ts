import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession, requireFeature } from "@/lib/auth";
import { readPosCharges } from "@/lib/pricing";

// Lectura: el punto de venta (admin y cajero) la necesita para mostrar los cobros del negocio.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pos");
  if (denied) return denied;

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("posConfig").lean() as
    | { posConfig?: unknown }
    | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json(readPosCharges(tenant.posConfig));
}

// Escritura: solo desde Configuración → Caja (feature "configuracion", solo admin). El punto de
// venta ya no puede cambiar el impuesto, el servicio ni la propina, ni desde la pantalla ni
// llamando a esta API.
export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "configuracion");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  for (const key of ["ivaEnabled", "serviceEnabled", "tipEnabled"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") {
      return NextResponse.json({ error: `${key} debe ser verdadero o falso` }, { status: 400 });
    }
    update[`posConfig.${key}`] = body[key];
  }
  for (const key of ["ivaRate", "serviceRate"] as const) {
    if (body[key] === undefined) continue;
    const rate = Number(body[key]);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: `${key} debe ser un porcentaje entre 0 y 100` }, { status: 400 });
    }
    update[`posConfig.${key}`] = rate;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para guardar" }, { status: 400 });
  }

  const tenant = await Tenant.findByIdAndUpdate(session.tenantId, { $set: update }, { returnDocument: "after" })
    .select("posConfig")
    .lean() as { posConfig?: unknown } | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json(readPosCharges(tenant.posConfig));
}
