import { NextRequest, NextResponse, after } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { recordErrorEvents } from "@/server/services/errorEvents";
import { checkErrorAlerts } from "@/server/services/errorAlerts";

export interface AgentTenant {
  _id: string;
  name: string;
  plan: string;
}

export type AgentAuthResult =
  | { ok: true; tenant: AgentTenant }
  | { ok: false; response: NextResponse };

const TOKEN_RE = /^[a-f0-9]{64}$/;

/**
 * Deja constancia en el registro de errores cuando la nube rechaza a un agente: así se ve en el
 * superadmin que un negocio dejó de imprimir comandas por un token viejo o un plan vencido.
 */
function reportRejection(request: NextRequest, status: number, message: string, tenant?: { _id: unknown; slug?: string }) {
  after(async () => {
    try {
      await recordErrorEvents(
        [{ source: "agente", kind: "agente_rechazado", method: request.method, route: request.nextUrl.pathname, status, message }],
        { tenantId: tenant ? String(tenant._id) : null, tenantSlug: tenant?.slug ?? "", userAgent: request.headers.get("user-agent") ?? "" },
      );
      await checkErrorAlerts();
    } catch (err) {
      console.error("[errores] no se pudo registrar el rechazo del agente", err);
    }
  });
}

export async function authenticateAgent(request: NextRequest): Promise<AgentAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim() ?? "";
  if (!TOKEN_RE.test(token)) {
    // Sin formato de token no es un agente nuestro: no se registra.
    return { ok: false, response: NextResponse.json({ error: "Token inválido" }, { status: 401 }) };
  }

  await connectToDatabase();
  const tenant = await Tenant.findOne({ printAgentToken: token })
    .select("name plan status slug")
    .lean() as { _id: unknown; name: string; plan: string; status: string; slug: string } | null;

  if (!tenant) {
    // Formato correcto pero de ningún negocio: casi siempre un token que se regeneró en Configuración.
    reportRejection(request, 401, "Token del agente no coincide con ningún negocio");
    return { ok: false, response: NextResponse.json({ error: "Token inválido" }, { status: 401 }) };
  }
  if (tenant.status !== "active") {
    reportRejection(request, 403, "Negocio inactivo", tenant);
    return { ok: false, response: NextResponse.json({ error: "Negocio inactivo" }, { status: 403 }) };
  }
  if (tenant.plan !== "premium") {
    reportRejection(request, 403, "Disponible en el plan Premium", tenant);
    return { ok: false, response: NextResponse.json({ error: "Disponible en el plan Premium" }, { status: 403 }) };
  }

  // "Agente conectado hace X s": cada petición autenticada cuenta como señal de vida
  await Tenant.updateOne({ _id: tenant._id }, { $set: { printAgentLastSeenAt: new Date() } });

  return { ok: true, tenant: { _id: String(tenant._id), name: tenant.name, plan: tenant.plan } };
}
