import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SiteSettings } from "@/models/SiteSettings";
import { getSession } from "@/lib/auth";

const DEFAULTS = {
  about: {
    title: "Hechos con amor en Turrialba",
    paragraph1: "Dulce Pecado nació de un momento espontáneo, con muchas ganas de crear algo especial.",
    paragraph2: "Hoy, cada postre y cada apretado gourmet está hecho con amor, buscando convertir lo simple en algo delicioso 🤍✨",
    images: [
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=80&fit=crop",
      "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&q=80&fit=crop",
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80&fit=crop",
      "https://images.unsplash.com/photo-1560008581-09826d1de69e?w=400&q=80&fit=crop",
    ],
  },
};

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const settings = await SiteSettings.findOne({ tenantId: session.tenantId }).lean();
  return NextResponse.json(settings ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();
  const settings = await SiteSettings.findOneAndUpdate({ tenantId: session.tenantId }, { ...body, tenantId: session.tenantId }, {
    upsert: true,
    new: true,
    runValidators: true,
  }).lean();
  return NextResponse.json(settings);
}
