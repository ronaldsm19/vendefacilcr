import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { StaffUser, type StaffRole } from "@/models/StaffUser";
import { WorkShift } from "@/models/WorkShift";
import { getSession, requireFeature } from "@/lib/auth";
import { isDesktopRequest } from "@/lib/device";
import { isPinBlocked, recordPinFailure, clearPinAttempts } from "@/lib/workShiftPinLimiter";

interface StaffLean {
  _id: { toString(): string };
  name: string;
  role: StaffRole;
  pinHash: string;
  active: boolean;
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "jornada");
  if (denied) return denied;

  if (!isDesktopRequest(request)) {
    return NextResponse.json(
      { error: "El marcaje de jornada solo se puede hacer desde la computadora del negocio" },
      { status: 403 }
    );
  }

  await connectToDatabase();

  const body = await request.json().catch(() => ({}));
  const staffUserId = typeof body.staffUserId === "string" ? body.staffUserId : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!staffUserId || !pin) {
    return NextResponse.json({ error: "Falta la persona o el PIN" }, { status: 400 });
  }

  const rateKey = `${session.tenantId}:${staffUserId}`;
  if (isPinBlocked(rateKey)) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo." },
      { status: 429 }
    );
  }

  const staff = await StaffUser.findOne({ _id: staffUserId, tenantId: session.tenantId, active: true })
    .select("name role pinHash active")
    .lean<StaffLean | null>();
  if (!staff) {
    return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });
  }

  const pinMatch = await bcrypt.compare(pin, staff.pinHash);
  if (!pinMatch) {
    recordPinFailure(rateKey);
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }
  clearPinAttempts(rateKey);

  const openShift = await WorkShift.findOne({
    tenantId: session.tenantId,
    staffUserId,
    status: "abierta",
  });
  if (!openShift) {
    return NextResponse.json({ error: "Esta persona no tiene una jornada abierta" }, { status: 409 });
  }

  const endedAt = new Date();
  const minutes = Math.max(0, Math.round((endedAt.getTime() - openShift.startedAt.getTime()) / 60000));

  openShift.endedAt = endedAt;
  openShift.minutes = minutes;
  openShift.status = "cerrada";
  openShift.closedBy = "staff";
  await openShift.save();

  return NextResponse.json({
    shift: {
      _id: openShift._id,
      startedAt: openShift.startedAt,
      endedAt: openShift.endedAt,
      minutes: openShift.minutes,
      staffUserId,
      staffName: staff.name,
      staffRole: staff.role,
    },
  });
}
