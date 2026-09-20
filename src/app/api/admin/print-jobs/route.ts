import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { PrintJob } from "@/models/PrintJob";
import { Tenant } from "@/models/Tenant";

interface PrintJobLean {
  _id: unknown;
  type: string;
  station: string;
  status: string;
  attempts: number;
  lastError: string;
  claimedAt: Date | null;
  printedAt: Date | null;
  createdAt: Date;
  refId: string;
  payload: Record<string, unknown>;
}

function labelFor(job: PrintJobLean): string {
  const p = job.payload;
  if (job.type === "comanda") {
    const version = typeof p.version === "number" ? p.version : 1;
    return `Comanda #${p.numero} · ${p.stationLabel}` + (version > 1 ? ` (v${version})` : "");
  }
  if (job.type === "venta") {
    return `Venta ${p.ticketNumber ?? p.saleNumber ?? ""}`;
  }
  if (job.type === "cierre") {
    return `Cierre ${p.closeNumber ?? ""}`;
  }
  return job.type;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const [jobs, tenant] = await Promise.all([
    PrintJob.find({ tenantId: session.tenantId }).sort({ createdAt: -1, _id: -1 }).limit(20).lean() as Promise<PrintJobLean[]>,
    Tenant.findById(session.tenantId).select("printAgentLastSeenAt").lean() as Promise<{ printAgentLastSeenAt?: Date | null } | null>,
  ]);

  return NextResponse.json({
    agentLastSeenAt: tenant?.printAgentLastSeenAt ?? null,
    jobs: jobs.map((j) => ({
      id: String(j._id),
      type: j.type,
      station: j.station,
      label: labelFor(j),
      status: j.status,
      attempts: j.attempts,
      lastError: j.lastError,
      claimedAt: j.claimedAt,
      printedAt: j.printedAt,
      createdAt: j.createdAt,
      refId: j.refId,
    })),
  });
}
