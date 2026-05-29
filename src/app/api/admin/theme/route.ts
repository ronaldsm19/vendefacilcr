import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LOGO_SHAPES = ["circle", "rounded", "square", "none"] as const;
const FONT_FAMILIES = ["default", "playfair", "montserrat", "nunito", "lato"] as const;

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("theme").lean() as
    | { theme?: Record<string, unknown> }
    | null;

  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json({
    primaryColor:    (tenant.theme?.primaryColor    as string) ?? "#6366F1",
    secondaryColor:  (tenant.theme?.secondaryColor  as string) ?? "#8B5CF6",
    accentColor:     (tenant.theme?.accentColor     as string) ?? "#F59E0B",
    backgroundColor: (tenant.theme?.backgroundColor as string) ?? "#FFFFFF",
    logoShape:       (tenant.theme?.logoShape       as string) ?? "circle",
    logoBgColor:     (tenant.theme?.logoBgColor     as string) ?? "",
    heroImageUrl:    (tenant.theme?.heroImageUrl    as string) ?? "",
    fontFamily:      (tenant.theme?.fontFamily      as string) ?? "default",
    darkMode:        (tenant.theme?.darkMode        as boolean) ?? false,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  const update: Record<string, unknown> = {};

  if (body.primaryColor !== undefined) {
    if (!HEX_RE.test(body.primaryColor)) return NextResponse.json({ error: "primaryColor inválido" }, { status: 400 });
    update["theme.primaryColor"] = body.primaryColor;
  }
  if (body.secondaryColor !== undefined) {
    if (!HEX_RE.test(body.secondaryColor)) return NextResponse.json({ error: "secondaryColor inválido" }, { status: 400 });
    update["theme.secondaryColor"] = body.secondaryColor;
  }
  if (body.accentColor !== undefined) {
    if (!HEX_RE.test(body.accentColor)) return NextResponse.json({ error: "accentColor inválido" }, { status: 400 });
    update["theme.accentColor"] = body.accentColor;
  }
  if (body.backgroundColor !== undefined) {
    if (!HEX_RE.test(body.backgroundColor)) return NextResponse.json({ error: "backgroundColor inválido" }, { status: 400 });
    update["theme.backgroundColor"] = body.backgroundColor;
  }
  if (body.logoShape !== undefined) {
    if (!LOGO_SHAPES.includes(body.logoShape)) return NextResponse.json({ error: "logoShape inválido" }, { status: 400 });
    update["theme.logoShape"] = body.logoShape;
  }
  if (body.logoBgColor !== undefined) {
    if (body.logoBgColor !== "" && !HEX_RE.test(body.logoBgColor)) return NextResponse.json({ error: "logoBgColor inválido" }, { status: 400 });
    update["theme.logoBgColor"] = body.logoBgColor;
  }
  if (body.heroImageUrl !== undefined) {
    update["theme.heroImageUrl"] = body.heroImageUrl;
  }
  if (body.fontFamily !== undefined) {
    if (!FONT_FAMILIES.includes(body.fontFamily)) return NextResponse.json({ error: "fontFamily inválido" }, { status: 400 });
    update["theme.fontFamily"] = body.fontFamily;
  }
  if (body.darkMode !== undefined) {
    update["theme.darkMode"] = Boolean(body.darkMode);
  }

  await Tenant.findByIdAndUpdate(session.tenantId, { $set: update }, { runValidators: true });

  return NextResponse.json({ ok: true });
}
