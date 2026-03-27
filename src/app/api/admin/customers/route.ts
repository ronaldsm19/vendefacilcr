import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  await connectToDatabase();

  const customers = await Order.aggregate([
    { $match: { tenantId: new (await import("mongoose")).default.Types.ObjectId(session.tenantId) } },
    ...(q ? [{ $match: { customerName: { $regex: q, $options: "i" } } }] : []),
    { $sort: { orderedAt: -1 as const } },
    {
      $group: {
        _id: { $toLower: "$customerName" },
        customerName: { $first: "$customerName" },
        phone: { $first: "$phone" },
      },
    },
    { $sort: { customerName: 1 as const } },
    { $limit: 10 },
    { $project: { _id: 0, customerName: 1, phone: 1 } },
  ]);
  return NextResponse.json({ customers });
}
