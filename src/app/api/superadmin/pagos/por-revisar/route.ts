import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { reviewQueueCount } from "@/server/services/mensualidad";

/** Cuántos comprobantes esperan revisión: el número junto a "Pagos" en el menú. */
export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ count: await reviewQueueCount() });
}
