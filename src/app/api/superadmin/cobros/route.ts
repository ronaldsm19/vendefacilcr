import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { getBillingSettings, updateBillingSettings, moneySummary } from "@/server/services/billing";
import { BILLING_LIMITS } from "@/models/BillingSettings";
import { crDay } from "@/lib/billing";

/** Configuración del cobro automático y resumen de plata de un mes (por defecto, el actual). */
export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const now = crDay(new Date());
  const year = Number(searchParams.get("year")) || now.y;
  const month = Number(searchParams.get("month")) || now.m;
  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  }
  const [settings, summary] = await Promise.all([getBillingSettings(), moneySummary(year, month)]);
  return NextResponse.json({ settings, summary, limits: BILLING_LIMITS, cronConfigured: Boolean(process.env.CRON_SECRET) });
}

export async function PUT(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  try {
    const settings = await updateBillingSettings(body as Record<string, unknown>, session.email);
    return NextResponse.json({ settings });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
