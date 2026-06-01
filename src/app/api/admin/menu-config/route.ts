import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { getSession } from "@/lib/auth";

const VALID_COLUMNS = [1, 2, 3] as const;
const VALID_FONTS = ["default", "playfair", "montserrat", "nunito", "lato"] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const tenant = await Tenant.findById(session.tenantId).select("menuConfig").lean() as
    | { menuConfig?: Record<string, unknown> }
    | null;

  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  return NextResponse.json({
    columns:        (tenant.menuConfig?.columns        as number)  ?? 2,
    showImage:      (tenant.menuConfig?.showImage      as boolean) ?? true,
    showPrice:      (tenant.menuConfig?.showPrice      as boolean) ?? true,
    primaryColor:   (tenant.menuConfig?.primaryColor   as string)  ?? "",
    secondaryColor: (tenant.menuConfig?.secondaryColor as string)  ?? "",
    accentColor:    (tenant.menuConfig?.accentColor    as string)  ?? "",
    bgImageUrl:     (tenant.menuConfig?.bgImageUrl     as string)  ?? "",
    bgBlur:         (tenant.menuConfig?.bgBlur         as number)  ?? 0,
    title:          (tenant.menuConfig?.title          as string)  ?? "",
    description:    (tenant.menuConfig?.description    as string)  ?? "",
    fontFamily:     (tenant.menuConfig?.fontFamily     as string)  ?? "default",
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  const update: Record<string, unknown> = {};

  if (body.columns !== undefined) {
    if (!VALID_COLUMNS.includes(body.columns)) {
      return NextResponse.json({ error: "columns debe ser 1, 2 o 3" }, { status: 400 });
    }
    update["menuConfig.columns"] = body.columns;
  }
  if (body.showImage !== undefined) {
    update["menuConfig.showImage"] = Boolean(body.showImage);
  }
  if (body.showPrice !== undefined) {
    update["menuConfig.showPrice"] = Boolean(body.showPrice);
  }
  if (body.primaryColor !== undefined) {
    if (body.primaryColor !== "" && !HEX_RE.test(body.primaryColor)) {
      return NextResponse.json({ error: "primaryColor inválido" }, { status: 400 });
    }
    update["menuConfig.primaryColor"] = body.primaryColor;
  }
  if (body.secondaryColor !== undefined) {
    if (body.secondaryColor !== "" && !HEX_RE.test(body.secondaryColor)) {
      return NextResponse.json({ error: "secondaryColor inválido" }, { status: 400 });
    }
    update["menuConfig.secondaryColor"] = body.secondaryColor;
  }
  if (body.accentColor !== undefined) {
    if (body.accentColor !== "" && !HEX_RE.test(body.accentColor)) {
      return NextResponse.json({ error: "accentColor inválido" }, { status: 400 });
    }
    update["menuConfig.accentColor"] = body.accentColor;
  }
  if (body.bgImageUrl !== undefined) {
    update["menuConfig.bgImageUrl"] = body.bgImageUrl;
  }
  if (body.bgBlur !== undefined) {
    const blur = Number(body.bgBlur);
    if (isNaN(blur) || blur < 0 || blur > 100) {
      return NextResponse.json({ error: "bgBlur debe ser 0-100" }, { status: 400 });
    }
    update["menuConfig.bgBlur"] = blur;
  }
  if (body.title !== undefined) {
    update["menuConfig.title"] = String(body.title).slice(0, 120);
  }
  if (body.description !== undefined) {
    update["menuConfig.description"] = String(body.description).slice(0, 300);
  }
  if (body.fontFamily !== undefined) {
    if (!VALID_FONTS.includes(body.fontFamily)) {
      return NextResponse.json({ error: "fontFamily inválido" }, { status: 400 });
    }
    update["menuConfig.fontFamily"] = body.fontFamily;
  }

  await Tenant.findByIdAndUpdate(session.tenantId, { $set: update }, { runValidators: true });

  return NextResponse.json({ ok: true });
}
