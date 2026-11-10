import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { markNoticeSeen } from "@/server/services/notices";

/** Registra que quien está en el panel cerró un aviso. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await markNoticeSeen(session, id));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
