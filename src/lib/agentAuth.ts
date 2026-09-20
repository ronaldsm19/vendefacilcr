import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";

export interface AgentTenant {
  _id: string;
  name: string;
  plan: string;
}

export type AgentAuthResult =
  | { ok: true; tenant: AgentTenant }
  | { ok: false; response: NextResponse };

const TOKEN_RE = /^[a-f0-9]{64}$/;

export async function authenticateAgent(request: NextRequest): Promise<AgentAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim() ?? "";
  if (!TOKEN_RE.test(token)) {
    return { ok: false, response: NextResponse.json({ error: "Token inválido" }, { status: 401 }) };
  }

  await connectToDatabase();
  const tenant = await Tenant.findOne({ printAgentToken: token })
    .select("name plan status")
    .lean() as { _id: unknown; name: string; plan: string; status: string } | null;

  if (!tenant) {
    return { ok: false, response: NextResponse.json({ error: "Token inválido" }, { status: 401 }) };
  }
  if (tenant.status !== "active") {
    return { ok: false, response: NextResponse.json({ error: "Negocio inactivo" }, { status: 403 }) };
  }
  if (tenant.plan !== "premium") {
    return { ok: false, response: NextResponse.json({ error: "Disponible en el plan Premium" }, { status: 403 }) };
  }

  // "Agente conectado hace X s": cada petición autenticada cuenta como señal de vida
  await Tenant.updateOne({ _id: tenant._id }, { $set: { printAgentLastSeenAt: new Date() } });

  return { ok: true, tenant: { _id: String(tenant._id), name: tenant.name, plan: tenant.plan } };
}
