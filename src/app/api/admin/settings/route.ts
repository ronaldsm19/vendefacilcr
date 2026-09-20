import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SiteSettings } from "@/models/SiteSettings";
import { getSession, requireFeature } from "@/lib/auth";

const DEFAULTS = {
  hero: {
    tagline:    "",
    subtagline: "",
    badge:      "",
  },
  about: {
    title:      "",
    paragraph1: "",
    paragraph2: "",
    images:     [],
  },
};

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "configuracion");
  if (denied) return denied;

  await connectToDatabase();
  const settings = await SiteSettings.findOne({ tenantId: session.tenantId }).lean();
  return NextResponse.json(settings ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "configuracion");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json();
  const settings = await SiteSettings.findOneAndUpdate({ tenantId: session.tenantId }, { ...body, tenantId: session.tenantId }, {
    upsert: true,
    new: true,
    runValidators: true,
  }).lean();
  return NextResponse.json(settings);
}
