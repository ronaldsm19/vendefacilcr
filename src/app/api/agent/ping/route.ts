// Comportamiento esperado del agente (vfprintagent, prompt 04b — NO se modifica ese repo
// desde acá, solo se documenta el contrato que consume): ante 401 o 403 el agente NO deja
// de hacer polling: fija el intervalo en 30 s y registra el motivo una sola vez por racha
// ("la nube rechazó el token: revisá cloudToken" / "plan no premium"), así se recupera solo
// cuando el admin regenera el token o reactiva Premium, sin reiniciar el .exe de la PC. Ante
// error de red o 5xx reintenta con backoff exponencial hasta 30 s y vuelve al intervalo base
// (pollIntervalMs) en el primer poll exitoso.

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateAgent } from "@/lib/agentAuth";
import { PrintJob } from "@/models/PrintJob";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;

  await connectToDatabase();
  const pending = await PrintJob.countDocuments({ tenantId: auth.tenant._id, status: "pending" });

  const response = NextResponse.json({ ok: true, tenantName: auth.tenant.name, pending });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
