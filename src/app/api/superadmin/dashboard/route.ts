import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { Payment } from "@/models/Payment";
import { TenantRequest } from "@/models/TenantRequest";
import { getSuperadminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    totalTenants,
    activeTenants,
    morososCount,
    pendingRequests,
    revenueResult,
  ] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: "active" }),
    Payment.countDocuments({ status: "late" }),
    TenantRequest.countDocuments({ status: "pending" }),
    Payment.aggregate([
      { $match: { status: "paid", periodYear: year, periodMonth: month } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const revenueThisMonth = revenueResult[0]?.total ?? 0;

  return NextResponse.json({
    totalTenants,
    activeTenants,
    morososCount,
    pendingRequests,
    revenueThisMonth,
  });
}
