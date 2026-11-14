import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer, type ICustomer } from "@/models/Customer";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { normalizeIdNumber } from "@/lib/customerId";
import { lookupHacienda } from "@/server/services/haciendaLookup";
import { consumeAttempt } from "@/server/services/rateLimit";
import { toCustomerView } from "@/server/services/customers";

// Busca una cédula en Hacienda para llenar el formulario del cliente. Si ya está registrada en el
// negocio, también la devuelve, para usarla en vez de crear otra.

const MAX_PER_MINUTE = 30;

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "clientes");
  if (denied) return denied;
  const deniedPlan = await requirePlan(session, "clientes");
  if (deniedPlan) return deniedPlan;

  const digits = normalizeIdNumber(request.nextUrl.searchParams.get("id") ?? "");
  if (!/^\d{9,12}$/.test(digits)) {
    return NextResponse.json({ error: "Escribí una identificación de 9 a 12 dígitos" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Customer.findOne({ tenantId: session.tenantId, idNumber: digits }).lean<ICustomer>();

  if (!(await consumeAttempt(`hacienda-lookup:${session.tenantId}`, MAX_PER_MINUTE, 60_000))) {
    return NextResponse.json(
      {
        error: "Demasiadas consultas seguidas. Esperá un minuto o llená los datos a mano.",
        existing: existing ? toCustomerView(existing) : null,
      },
      { status: 429 },
    );
  }

  const hacienda = await lookupHacienda(digits);
  return NextResponse.json({ hacienda, existing: existing ? toCustomerView(existing) : null });
}
