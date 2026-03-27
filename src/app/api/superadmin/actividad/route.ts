import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { AccessLog } from "@/models/AccessLog";
import { getSuperadminSession } from "@/lib/auth";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const tenantId   = searchParams.get("tenantId");
  const success    = searchParams.get("success");
  const from       = searchParams.get("from");
  const to         = searchParams.get("to");
  const page       = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit      = Math.min(100, Number(searchParams.get("limit") ?? 50));

  const query: Record<string, unknown> = {};
  if (tenantId && mongoose.Types.ObjectId.isValid(tenantId))
    query.tenantId = new mongoose.Types.ObjectId(tenantId);
  if (success !== null && success !== undefined) query.success = success === "true";
  if (from || to) {
    query.createdAt = {};
    if (from) (query.createdAt as Record<string, Date>).$gte = new Date(from);
    if (to)   (query.createdAt as Record<string, Date>).$lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    AccessLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AccessLog.countDocuments(query),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
