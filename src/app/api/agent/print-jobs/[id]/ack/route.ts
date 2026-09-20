import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateAgent } from "@/lib/agentAuth";
import { PrintJob } from "@/models/PrintJob";
import { PRINT_JOB_MAX_ATTEMPTS } from "@/lib/printQueue";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    const res = NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Body inválido: se espera { ok: boolean, error?: string }" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const { ok, error } = (body ?? {}) as { ok?: unknown; error?: unknown };
  if (typeof ok !== "boolean") {
    const res = NextResponse.json({ error: "Body inválido: se espera { ok: boolean, error?: string }" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const errorMessage = String(error ?? "").trim().slice(0, 500);

  await connectToDatabase();
  const tenantId = auth.tenant._id;

  const job = await PrintJob.findOne({ _id: id, tenantId }).lean() as
    | { _id: unknown; status: string; attempts: number } | null;
  if (!job) {
    const res = NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  let updated: { _id: unknown; status: string; attempts: number };

  if (job.status === "done" || (job.status === "failed" && ok === false)) {
    // Idempotente: un done repetido no cambia nada; un ack de fallo sobre un job
    // ya failed (agotado o cancelado) no lo revive.
    updated = job;
  } else if (ok === true) {
    const now = new Date();
    const doc = await PrintJob.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: "done", printedAt: now, lastError: "" } },
      { new: true }
    ).lean() as { _id: unknown; status: string; attempts: number } | null;
    updated = doc ?? job;
  } else {
    const nextStatus = job.attempts >= PRINT_JOB_MAX_ATTEMPTS ? "failed" : "pending";
    const doc = await PrintJob.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: nextStatus, lastError: errorMessage || "Error de impresión", claimedAt: null } },
      { new: true }
    ).lean() as { _id: unknown; status: string; attempts: number } | null;
    updated = doc ?? job;
  }

  const res = NextResponse.json({ ok: true, id: String(updated._id), status: updated.status, attempts: updated.attempts });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
