import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { runBillingCycle } from "@/server/services/billing";

/**
 * Corre el cobro automático a mano. Con `dryRun: true` es la vista previa: no escribe ni manda nada.
 * `fecha` (AAAA-MM-DD) simula otro día, solo en desarrollo, para probar el ciclo completo.
 */
export async function POST(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { dryRun?: unknown; fecha?: unknown; negocios?: unknown };
  const dev = process.env.NODE_ENV !== "production";

  // Solo en desarrollo: limitar la corrida a ciertos negocios, para probar sin tocar los demás.
  const onlySlugs = dev && Array.isArray(body.negocios) ? body.negocios.filter((s): s is string => typeof s === "string") : undefined;

  let now: Date | undefined;
  if (typeof body.fecha === "string" && dev) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(body.fecha);
    if (!match) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    // 8:00 a. m. de Costa Rica de ese día, como el cron.
    now = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 14));
  }

  const result = await runBillingCycle({ now, dryRun: body.dryRun !== false, onlySlugs });
  return NextResponse.json(result);
}
