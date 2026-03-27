import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/models/Category";
import { getSession } from "@/lib/auth";

const DEFAULTS = ["Gelatina Mosaico", "Apretado Gourmet", "Edición Especial"];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  let cats = await Category.find({ tenantId: session.tenantId }).sort({ label: 1 }).lean();
  if (cats.length === 0) {
    await Category.insertMany(DEFAULTS.map((label) => ({ label, tenantId: session.tenantId })));
    cats = await Category.find({ tenantId: session.tenantId }).sort({ label: 1 }).lean();
  }
  return NextResponse.json({ categories: JSON.parse(JSON.stringify(cats)) });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { label } = await request.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label requerido" }, { status: 400 });
  }

  const existing = await Category.findOne({
    tenantId: session.tenantId,
    label: { $regex: `^${label.trim()}$`, $options: "i" },
  }).lean();
  if (existing) {
    return NextResponse.json({ category: JSON.parse(JSON.stringify(existing)) });
  }

  const cat = await Category.create({ tenantId: session.tenantId, label: label.trim() });
  return NextResponse.json({ category: JSON.parse(JSON.stringify(cat)) }, { status: 201 });
}
