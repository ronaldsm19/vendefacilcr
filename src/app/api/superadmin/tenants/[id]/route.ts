import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { Payment } from "@/models/Payment";
import { AccessLog } from "@/models/AccessLog";
import { getSuperadminSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();

  const [tenant, payments, accessLogs] = await Promise.all([
    Tenant.findById(id).lean(),
    Payment.find({ tenantId: id }).sort({ periodYear: -1, periodMonth: -1 }).limit(12).lean(),
    AccessLog.find({ tenantId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ tenant, payments, accessLogs });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  const allowedFields = ["name", "email", "whatsappNumber", "plan", "status", "theme", "logoUrl", "description"];
  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  const tenant = await Tenant.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ tenant });
}
