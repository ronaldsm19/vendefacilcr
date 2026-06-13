import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";
import { DEFAULT_TICKET_CONFIG, type TicketConfigData } from "@/lib/ticket";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("ticketConfig").lean() as
    | { ticketConfig?: Partial<TicketConfigData> }
    | null;

  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json({
    ticketConfig: { ...DEFAULT_TICKET_CONFIG, ...(tenant.ticketConfig ?? {}) },
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const update: Record<string, unknown> = {};

  const textFields: (keyof TicketConfigData)[] = [
    "businessName", "location", "address", "phone", "email",
    "ownerName", "taxId", "taxRegime", "footerMessage",
    "terminalNumber", "ticketPrefix",
  ];
  for (const field of textFields) {
    if (body[field] !== undefined) update[`ticketConfig.${field}`] = String(body[field]);
  }

  await Tenant.findByIdAndUpdate(session.tenantId, { $set: update });
  return NextResponse.json({ ok: true });
}
