import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import type { PlanScope } from "@/lib/permissions";

/**
 * Si el negocio de una sesión puede seguir usando el panel, y con qué plan. Lo consulta getSession
 * en cada pedido, así que una suspensión corta las sesiones abiertas (web y app) sin esperar a que
 * venza el token; las rutas de secciones con plan mínimo leen de acá el plan, sin otra consulta.
 *
 * Se guarda un minuto por instancia: es lo que puede tardar en cortarse una sesión abierta después
 * de suspender (o en verse un cambio de plan), a cambio de no leer la base en cada pedido del panel.
 */

const TTL_MS = 60_000;
const MAX_ENTRIES = 2000;

interface TenantAccess extends PlanScope {
  active: boolean;
}

const cache = new Map<string, { access: TenantAccess; at: number }>();

/** Sin negocio válido: inactivo y con el plan más chico, por si alguien llega a preguntar el plan. */
const NO_ACCESS: TenantAccess = { active: false, plan: "emprende", planLimits: true };

async function tenantAccess(tenantId: string): Promise<TenantAccess> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.access;
  if (!mongoose.isValidObjectId(tenantId)) return NO_ACCESS;

  await connectToDatabase();
  const tenant = await Tenant.findById(tenantId).select("status plan planLimits").lean() as
    { status?: string; plan?: string; planLimits?: boolean } | null;
  const access: TenantAccess = tenant
    ? { active: tenant.status === "active", plan: tenant.plan ?? "emprende", planLimits: tenant.planLimits === true }
    : NO_ACCESS;

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(tenantId, { access, at: Date.now() });
  return access;
}

export async function isTenantActive(tenantId: string): Promise<boolean> {
  return (await tenantAccess(tenantId)).active;
}

/** El plan del negocio y si tiene los límites aplicados (ver planNeededFor). */
export async function getTenantPlanScope(tenantId: string): Promise<PlanScope> {
  const { plan, planLimits } = await tenantAccess(tenantId);
  return { plan, planLimits };
}

/** Al cambiar el estado o el plan desde el superadmin: esta instancia deja de usar el valor guardado. */
export function forgetTenantStatus(tenantId: string) {
  cache.delete(tenantId);
}
