import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { createHelpVideo, listHelpVideos } from "@/server/services/helpVideos";

/** Videos de ayuda: todos (visibles y ocultos), y cargar uno nuevo. */
export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await listHelpVideos());
}

export async function POST(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  try {
    return NextResponse.json(await createHelpVideo(body as Record<string, unknown>, session.email), { status: 201 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
