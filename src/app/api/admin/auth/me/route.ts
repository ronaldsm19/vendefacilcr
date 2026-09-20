import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { StaffUser } from "@/models/StaffUser";
import { getSession, COOKIE_NAME } from "@/lib/auth";
import { isPremiumPlan } from "@/lib/permissions";
import { DEFAULT_TICKET_CONFIG, type TicketConfigData } from "@/lib/ticket";

function loggedOut(): NextResponse {
  const response = NextResponse.json({ error: "No autenticado" }, { status: 401 });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

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

  const isPremium = isPremiumPlan(tenant?.plan);

  if (session.role !== "admin") {
    if (!isPremium) return loggedOut();
    const alive = await StaffUser.exists({ _id: session.userId, tenantId: session.tenantId, active: true });
    if (!alive) return loggedOut();
  }

  return NextResponse.json({
    email:          session.email ?? "",
    role:           session.role,
    userId:         session.userId,
    name:           session.name,
    tenantSlug:     session.tenantSlug,
    tenantName:     tenant?.name     ?? session.tenantSlug,
    logoUrl:        tenant?.logoUrl  ?? "",
    plan:           tenant?.plan           ?? "emprende",
    isPremium,
    whatsappNumber: tenant?.whatsappNumber ?? "",
    passwordChanged: session.role === "admin" ? (tenant?.passwordChanged ?? false) : true,
    primaryColor:   (tenant?.theme?.primaryColor   as string) ?? "#6366F1",
    secondaryColor: (tenant?.theme?.secondaryColor as string) ?? "#8B5CF6",
    accentColor:    (tenant?.theme?.accentColor    as string) ?? "#F59E0B",
    ticketConfig:   { ...DEFAULT_TICKET_CONFIG, ...(tenant?.ticketConfig ?? {}) },
  });
}
