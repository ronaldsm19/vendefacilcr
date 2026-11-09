import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { getAlertSettings, updateAlertSettings } from "@/server/services/errorAlerts";
import { ERROR_ALERT_LIMITS } from "@/models/ErrorAlertSettings";

/** Configuración de los correos de alerta de errores (una sola, global). */

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const settings = await getAlertSettings();
  return NextResponse.json({ settings, limits: ERROR_ALERT_LIMITS });
}

export async function PUT(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  try {
    const settings = await updateAlertSettings(body as Record<string, unknown>, session.email);
    return NextResponse.json({ settings, limits: ERROR_ALERT_LIMITS });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
