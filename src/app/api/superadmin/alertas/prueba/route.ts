import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { sendTestAlert } from "@/server/services/errorAlerts";

/** Manda un correo de prueba a los destinatarios guardados. */
export async function POST(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const result = await sendTestAlert();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
