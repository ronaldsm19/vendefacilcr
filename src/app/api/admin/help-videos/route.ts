import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { helpVideosForSession } from "@/server/services/helpVideos";

/** Los videos de ayuda que ve quien está en el panel (los visibles de las secciones de su rol). */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await helpVideosForSession(session));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
