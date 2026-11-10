import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { noticesForSession } from "@/server/services/notices";

/** Avisos para quien está en el panel: el de cobro (solo el dueño) y los que mandó VendeFácil. */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await noticesForSession(session));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
