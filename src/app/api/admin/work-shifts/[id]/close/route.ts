import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { closeShiftAsAdmin } from "@/server/services/workShifts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const endedAtRaw = typeof body.endedAt === "string" ? body.endedAt : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  const endedAt = endedAtRaw ? new Date(endedAtRaw) : null;
  if (!endedAt || Number.isNaN(endedAt.getTime())) {
    return NextResponse.json({ error: "Hora de salida inválida" }, { status: 400 });
  }

  try {
    const shift = await closeShiftAsAdmin(session.tenantId, id, { endedAt, note }, {
      name:       session.name,
      email:      session.email,
      tenantSlug: session.tenantSlug,
      ip:         request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent:  request.headers.get("user-agent") ?? "",
    });
    return NextResponse.json({ shift });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
