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
import { PRINT_JOB_LEASE_MS, PRINT_JOB_MAX_ATTEMPTS } from "@/lib/printQueue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;

  await connectToDatabase();
  const tenantId = auth.tenant._id;

  let limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "5", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 5;
  if (limit > 20) limit = 20;

  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - PRINT_JOB_LEASE_MS);

  await PrintJob.updateMany(
    {
      tenantId,
      status: "printing",
      claimedAt: { $lte: leaseCutoff },
      attempts: { $gte: PRINT_JOB_MAX_ATTEMPTS },
    },
    { $set: { status: "failed", lastError: "Sin confirmación del agente tras 5 intentos", claimedAt: null } }
  );

  const claimed: { _id: unknown; type: string; payload: Record<string, unknown>; createdAt: Date }[] = [];
  for (let i = 0; i < limit; i++) {
    const job = await PrintJob.findOneAndUpdate(
      {
        tenantId,
        $or: [
          { status: "pending" },
          { status: "printing", claimedAt: { $lte: leaseCutoff }, attempts: { $lt: PRINT_JOB_MAX_ATTEMPTS } },
        ],
      },
      { $set: { status: "printing", claimedAt: now }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1, _id: 1 }, new: true }
    ).lean() as { _id: unknown; type: string; payload: Record<string, unknown>; createdAt: Date } | null;
    if (!job) break;
    claimed.push(job);
  }

  const response = NextResponse.json({
    jobs: claimed.map((j) => ({
      id: String(j._id),
      type: j.type,
      payload: j.payload,
      createdAt: new Date(j.createdAt).toISOString(),
    })),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
