import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { Product } from "@/models/Product";
import {
  isPremiumPlan, ERROR_PREMIUM, FEATURE_MIN_PLAN, planNeededFor, planRequiredMessage, productLimit,
  type Feature,
} from "@/lib/permissions";
import { getTenantPlanScope } from "@/server/services/tenantAccess";

export async function getTenantPlan(tenantId: string): Promise<string> {
  await connectToDatabase();
  const t = (await Tenant.findById(tenantId).select("plan").lean()) as { plan?: string } | null;
  return t?.plan ?? "emprende";
}

export async function isPremium(tenantId: string): Promise<boolean> {
  return isPremiumPlan(await getTenantPlan(tenantId));
}

export function premiumRequired(): NextResponse {
  return NextResponse.json({ error: ERROR_PREMIUM }, { status: 403 });
}

/** null si el tenant es premium; si no, 403 "Disponible en el plan Premium". */
export async function requirePremium(tenantId: string): Promise<NextResponse | null> {
  return (await isPremium(tenantId)) ? null : premiumRequired();
}

/**
 * null si el plan del negocio incluye la sección; si no, 403 con el plan que hace falta. Va junto a
 * requireFeature (que mira el rol): una cosa es quién puede, otra qué incluye el plan del negocio.
 */
export async function requirePlan(session: { tenantId: string }, feature: Feature): Promise<NextResponse | null> {
  if (!FEATURE_MIN_PLAN[feature]) return null;
  const needed = planNeededFor(await getTenantPlanScope(session.tenantId), feature);
  if (!needed) return null;
  return NextResponse.json(
    { error: planRequiredMessage(needed), code: "PLAN_REQUIRED", plan: needed },
    { status: 403 },
  );
}

/**
 * null si el negocio puede sumar `adding` productos; si no, 403 con el tope de su plan. Los que ya
 * tiene se quedan aunque pasen el tope (por ejemplo, si bajó de plan): solo se frena lo nuevo.
 */
export async function requireProductRoom(tenantId: string, adding: number): Promise<NextResponse | null> {
  const limit = productLimit(await getTenantPlanScope(tenantId));
  if (limit === null) return null;
  await connectToDatabase();
  const current = await Product.countDocuments({ tenantId });
  if (current + adding <= limit) return null;
  const room = Math.max(0, limit - current);
  const error = adding === 1 || room === 0
    ? `Tu plan Emprende permite hasta ${limit} productos y ya tenés ${current}. Con el plan Pro no hay límite.`
    : `Tu plan Emprende permite hasta ${limit} productos: tenés ${current} y el archivo trae ${adding}, así que solo caben ${room} más. Con el plan Pro no hay límite.`;
  return NextResponse.json({ error, code: "PRODUCT_LIMIT", limit, current }, { status: 403 });
}
