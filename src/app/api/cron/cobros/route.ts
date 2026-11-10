import { NextRequest, NextResponse } from "next/server";
import { runBillingCycle } from "@/server/services/billing";
import { BillingSettings } from "@/models/BillingSettings";

/**
 * Cobro automático diario (vercel.json → crons). Vercel manda `Authorization: Bearer <CRON_SECRET>`
 * cuando esa variable está definida en el proyecto; sin ella, la ruta no corre nada.
 * Si el cobro automático está apagado en la configuración, responde sin hacer cambios.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await runBillingCycle();
    return NextResponse.json({ ok: true, summary: result.summary, actions: result.actions.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron cobros]", err);
    await BillingSettings.updateOne({ key: "global" }, { $set: { lastRunAt: new Date(), lastRunError: message } }).catch(() => {});
    return NextResponse.json({ error: "Falló el cobro automático" }, { status: 500 });
  }
}
