import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { isPremiumPlan, ERROR_PREMIUM } from "@/lib/permissions";

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
