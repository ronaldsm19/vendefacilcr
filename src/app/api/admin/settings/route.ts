import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SiteSettings } from "@/models/SiteSettings";
import { getSession, requireFeature } from "@/lib/auth";
import { EMPTY_PRODUCTS_SECTION, readProductsSectionText } from "@/lib/storeTexts";

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
  productsSection: EMPTY_PRODUCTS_SECTION,
};

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "configuracion");
  if (denied) return denied;

  await connectToDatabase();
  const settings = await SiteSettings.findOne({ tenantId: session.tenantId }).lean() as Record<string, unknown> | null;
  if (!settings) return NextResponse.json(DEFAULTS);
  return NextResponse.json({ ...settings, productsSection: readProductsSectionText(settings.productsSection) });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "configuracion");
  if (denied) return denied;

  await connectToDatabase();
  const body = await request.json();
  // Textos de la sección de productos: solo texto, recortados y con su largo máximo.
  if (body.productsSection !== undefined) body.productsSection = readProductsSectionText(body.productsSection);
  const settings = await SiteSettings.findOneAndUpdate({ tenantId: session.tenantId }, { ...body, tenantId: session.tenantId }, {
    upsert: true,
    returnDocument: "after",
    runValidators: true,
  }).lean();
  return NextResponse.json(settings);
}
