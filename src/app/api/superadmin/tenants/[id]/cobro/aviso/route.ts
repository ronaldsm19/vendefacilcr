import { NextRequest, NextResponse } from "next/server";
import { getSuperadminSession } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { sendManualReminder } from "@/server/services/billing";

/** Manda ya el aviso de cobro de la factura sin pagar más antigua del negocio. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await sendManualReminder(id));
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
