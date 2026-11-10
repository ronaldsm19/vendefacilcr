import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { deleteNotice, setNoticeActive } from "@/server/services/notices";

/** Pausar o reanudar un aviso ({ active }). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(await setNoticeActive(id, (body as { active?: unknown }).active));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}

/** Borra el aviso y el registro de quién lo vio. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await deleteNotice(id));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
