import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { StaffUser, type StaffRole } from "@/models/StaffUser";
import { WorkShift } from "@/models/WorkShift";
import { getSession, requireFeature } from "@/lib/auth";

interface StaffLean {
  _id: { toString(): string };
  name: string;
  role: StaffRole;
}

interface OpenShiftLean {
  _id: { toString(): string };
  staffUserId: { toString(): string };
  startedAt: Date;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "jornada");
  if (denied) return denied;

  await connectToDatabase();

  const staff = await StaffUser.find({ tenantId: session.tenantId, active: true })
    .select("name role")
    .sort({ name: 1 })
    .lean<StaffLean[]>();

  const openShifts = await WorkShift.find({
    tenantId: session.tenantId,
    status: "abierta",
    staffUserId: { $in: staff.map((s) => s._id) },
  })
    .select("staffUserId startedAt")
    .lean<OpenShiftLean[]>();

  const openByStaff = new Map(openShifts.map((s) => [s.staffUserId.toString(), s]));

  return NextResponse.json({
    staff: staff.map((s) => {
      const open = openByStaff.get(s._id.toString());
      return {
        _id: s._id.toString(),
        name: s.name,
        role: s.role,
        openShift: open ? { _id: open._id.toString(), startedAt: open.startedAt } : null,
      };
    }),
  });
}
