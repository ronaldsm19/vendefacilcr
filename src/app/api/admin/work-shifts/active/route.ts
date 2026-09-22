import { NextRequest, NextResponse } from "next/server";
import { getSession, requireFeature } from "@/lib/auth";
import { listActiveStaff } from "@/server/services/workShifts";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "jornada");
  if (denied) return denied;

  return NextResponse.json({ staff: await listActiveStaff(session.tenantId) });
}
