import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { editShiftAsAdmin } from "@/server/services/workShifts";

function parseDate(raw: unknown): Date | null | "invalid" {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return "invalid";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

// Editar entrada y/o salida de una jornada: solo el admin.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const startedAt = parseDate(body.startedAt);
  const endedAt = parseDate(body.endedAt);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (!startedAt || startedAt === "invalid") {
    return NextResponse.json({ error: "Hora de entrada inválida" }, { status: 400 });
  }
  if (endedAt === "invalid") {
    return NextResponse.json({ error: "Hora de salida inválida" }, { status: 400 });
  }

  try {
    const shift = await editShiftAsAdmin(session.tenantId, id, { startedAt, endedAt, note }, {
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
