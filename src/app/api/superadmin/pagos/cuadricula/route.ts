import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { paymentsGrid } from "@/server/services/mensualidad";

/** Negocios por meses: el estado de la mensualidad de cada uno en los últimos meses (?meses=12). */
export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const months = Number(new URL(request.url).searchParams.get("meses") ?? 12) || 12;
  return NextResponse.json(await paymentsGrid(months));
}
