import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";
import { DEFAULT_TICKET_CONFIG, type TicketConfigData } from "@/lib/ticket";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId)
    .select("name logoUrl theme plan whatsappNumber passwordChanged ticketConfig")
    .lean() as {
      name?: string;
      logoUrl?: string;
      theme?: Record<string, unknown>;
      plan?: string;
      whatsappNumber?: string;
      passwordChanged?: boolean;
      ticketConfig?: Partial<TicketConfigData>;
    } | null;

  return NextResponse.json({
    email:          session.email,
    tenantSlug:     session.tenantSlug,
    tenantName:     tenant?.name     ?? session.tenantSlug,
    logoUrl:        tenant?.logoUrl  ?? "",
    plan:           tenant?.plan           ?? "emprende",
    whatsappNumber: tenant?.whatsappNumber ?? "",
    passwordChanged: tenant?.passwordChanged ?? false,
    primaryColor:   (tenant?.theme?.primaryColor   as string) ?? "#6366F1",
    secondaryColor: (tenant?.theme?.secondaryColor as string) ?? "#8B5CF6",
    accentColor:    (tenant?.theme?.accentColor    as string) ?? "#F59E0B",
    ticketConfig:   { ...DEFAULT_TICKET_CONFIG, ...(tenant?.ticketConfig ?? {}) },
  });
}
