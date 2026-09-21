import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { WorkShift } from "@/models/WorkShift";
import { AccessLog } from "@/models/AccessLog";
import { Tenant } from "@/models/Tenant";
import { getSession, requireRole } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireRole(session, "admin");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();

  const body = await request.json().catch(() => ({}));
  const endedAtRaw = typeof body.endedAt === "string" ? body.endedAt : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  const endedAt = endedAtRaw ? new Date(endedAtRaw) : null;
  if (!endedAt || Number.isNaN(endedAt.getTime())) {
    return NextResponse.json({ error: "Hora de salida inválida" }, { status: 400 });
  }

  const shift = await WorkShift.findOne({ _id: id, tenantId: session.tenantId });
  if (!shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  if (shift.status !== "abierta") {
    return NextResponse.json({ error: "Este turno ya está cerrado" }, { status: 409 });
  }

  const now = new Date();
  if (endedAt <= shift.startedAt) {
    return NextResponse.json({ error: "La hora de salida debe ser posterior al inicio del turno" }, { status: 400 });
  }
  if (endedAt > now) {
    return NextResponse.json({ error: "La hora de salida no puede estar en el futuro" }, { status: 400 });
  }

  const minutes = Math.max(0, Math.round((endedAt.getTime() - shift.startedAt.getTime()) / 60000));

  shift.endedAt = endedAt;
  shift.minutes = minutes;
  shift.status = "cerrada";
  shift.closedBy = "admin";
  shift.adjustedByName = session.name;
  shift.adjustNote = note;
  await shift.save();

  const tenant = await Tenant.findById(session.tenantId).select("slug").lean() as { slug?: string } | null;
  AccessLog.create({
    tenantId:   session.tenantId,
    tenantSlug: tenant?.slug ?? session.tenantSlug,
    userEmail:  session.email || session.name,
    ip:         request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    userAgent:  request.headers.get("user-agent") ?? "",
    success:    true,
    event:      "work_shift_adjust",
    path:       `workShiftId=${id};staffName=${shift.staffName};minutes=${minutes}`,
  }).catch(() => {});

  return NextResponse.json({
    shift: {
      _id: shift._id,
      staffUserId: shift.staffUserId,
      staffName: shift.staffName,
      staffRole: shift.staffRole,
      startedAt: shift.startedAt,
      endedAt: shift.endedAt,
      minutes: shift.minutes,
      status: shift.status,
      closedBy: shift.closedBy,
      adjustedByName: shift.adjustedByName,
      adjustNote: shift.adjustNote,
    },
  });
}
