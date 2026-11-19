import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { SalonTable } from "@/models/SalonTable";

/**
 * POST /api/admin/salon/tables/[id]/release — libera el candado de cobro de la mesa.
 * Un cajero solo libera el suyo; un admin puede forzar la liberación de cualquiera.
 * Siempre responde ok (liberar algo que ya no era mío no es un error).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  await SalonTable.updateOne(
    {
      _id: id,
      tenantId: session.tenantId,
      ...(session.role === "admin" ? {} : { "cobroLock.by": session.userId }),
    },
    { $set: { cobroLock: null } }
  );
  return NextResponse.json({ ok: true });
}
