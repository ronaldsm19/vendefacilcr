import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";

/**
 * Si el negocio de una sesión puede seguir usando el panel. Lo consulta getSession en cada pedido,
 * así que una suspensión corta las sesiones abiertas (web y app) sin esperar a que venza el token.
 *
 * Se guarda un minuto por instancia: es lo que puede tardar en cortarse una sesión abierta después
 * de suspender, a cambio de no leer la base en cada pedido del panel.
 */

const TTL_MS = 60_000;
const MAX_ENTRIES = 2000;
const cache = new Map<string, { active: boolean; at: number }>();

export async function isTenantActive(tenantId: string): Promise<boolean> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.active;
  if (!mongoose.isValidObjectId(tenantId)) return false;

  await connectToDatabase();
  const tenant = await Tenant.findById(tenantId).select("status").lean() as { status?: string } | null;
  const active = tenant?.status === "active";

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(tenantId, { active, at: Date.now() });
  return active;
}

/** Al cambiar el estado desde el superadmin: esta instancia deja de usar el valor guardado. */
export function forgetTenantStatus(tenantId: string) {
  cache.delete(tenantId);
}
