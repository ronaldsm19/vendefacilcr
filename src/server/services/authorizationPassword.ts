import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { ServiceError } from "@/server/errors";
import { consumeAttempt, clearAttempts } from "@/server/services/rateLimit";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

/**
 * Verifica la contraseña de eliminación del negocio (Configuración → Caja). La piden las acciones
 * que cambian plata ya registrada: borrar una venta, corregir la apertura de caja y editar un
 * cierre. Todas comparten el contador de intentos de cada persona (5 cada 15 minutos), así probar
 * claves en una pantalla no da intentos extra en otra. Sin contraseña configurada, la acción queda
 * bloqueada; `action` completa ese mensaje ("borrar ventas", "editar cierres de caja"...).
 */
export async function verifyAuthorizationPassword(
  session: { tenantId: string; userId: string },
  password: unknown,
  action: string,
): Promise<{ slug: string }> {
  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId)
    .select("saleDeletePasswordHash slug")
    .lean() as { saleDeletePasswordHash?: string; slug?: string } | null;
  if (!tenant) throw new ServiceError(404, "Tenant no encontrado");

  if (!tenant.saleDeletePasswordHash) {
    throw new ServiceError(
      409,
      `Configurá la contraseña de eliminación en Configuración → Caja antes de poder ${action}.`,
      "PASSWORD_NOT_CONFIGURED",
    );
  }

  if (typeof password !== "string" || !password) {
    throw new ServiceError(400, "Falta la contraseña", "PASSWORD_REQUIRED");
  }

  const rateKey = `sale-delete:${session.tenantId}:${session.userId}`;
  if (!(await consumeAttempt(rateKey, MAX_ATTEMPTS, WINDOW_MS))) {
    throw new ServiceError(429, "Demasiados intentos. Esperá unos minutos e intentá de nuevo.", "TOO_MANY_ATTEMPTS");
  }

  if (!(await bcrypt.compare(password, tenant.saleDeletePasswordHash))) {
    throw new ServiceError(403, "Contraseña incorrecta", "PASSWORD_INVALID");
  }
  await clearAttempts(rateKey);

  return { slug: tenant.slug ?? "" };
}
