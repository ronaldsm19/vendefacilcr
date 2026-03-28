import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId)
    .select("whatsappNumber instagram facebook tiktok youtube")
    .lean() as { whatsappNumber?: string; instagram?: string; facebook?: string; tiktok?: string; youtube?: string } | null;

  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json({
    whatsapp:  tenant.whatsappNumber ?? "",
    instagram: tenant.instagram ?? "",
    facebook:  tenant.facebook ?? "",
    tiktok:    tenant.tiktok ?? "",
    youtube:   tenant.youtube ?? "",
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { whatsapp, instagram, facebook, tiktok, youtube } = await request.json();

  await Tenant.findByIdAndUpdate(session.tenantId, {
    ...(whatsapp  !== undefined && { whatsappNumber: whatsapp }),
    ...(instagram !== undefined && { instagram }),
    ...(facebook  !== undefined && { facebook }),
    ...(tiktok    !== undefined && { tiktok }),
    ...(youtube   !== undefined && { youtube }),
  });

  return NextResponse.json({ ok: true });
}
