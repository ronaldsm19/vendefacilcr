import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { deleteHelpVideo, updateHelpVideo } from "@/server/services/helpVideos";

/** Cambiar un video: cualquiera de sus campos, o solo mostrarlo u ocultarlo ({ visible }). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  try {
    return NextResponse.json(await updateHelpVideo(id, body as Record<string, unknown>));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await deleteHelpVideo(id));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
