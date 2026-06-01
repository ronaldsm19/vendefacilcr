import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CashUser } from "@/models/CashUser";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const users = await CashUser.find({ tenantId: session.tenantId })
    .sort({ createdAt: 1 })
    .lean();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const user = await CashUser.create({ tenantId: session.tenantId, name: name.trim() });
  return NextResponse.json({ user }, { status: 201 });
}
