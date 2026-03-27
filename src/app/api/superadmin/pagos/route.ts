import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Payment, PLAN_AMOUNTS } from "@/models/Payment";
import { Tenant } from "@/models/Tenant";
import { getSuperadminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const year   = searchParams.get("year")  ? Number(searchParams.get("year"))  : undefined;
  const month  = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
  const page   = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit  = Math.min(100, Number(searchParams.get("limit") ?? 30));

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (year)   query.periodYear  = year;
  if (month)  query.periodMonth = month;

  const [payments, total] = await Promise.all([
    Payment.find(query).sort({ periodYear: -1, periodMonth: -1, tenantSlug: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(query),
  ]);

  return NextResponse.json({ payments, total, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const body = await request.json();

  // Generate all invoices for a month
  if (body.generateAll) {
    const now  = new Date();
    const year  = body.year  ?? now.getFullYear();
    const month = body.month ?? now.getMonth() + 1;
    const dueDate = new Date(year, month - 1, 1);

    const tenants = await Tenant.find({ status: "active" }).lean();
    const ops = tenants.map((t) => ({
      updateOne: {
        filter: { tenantId: t._id, periodYear: year, periodMonth: month },
        update: {
          $setOnInsert: {
            tenantId:    t._id,
            tenantName:  t.name,
            tenantSlug:  t.slug,
            plan:        t.plan,
            periodYear:  year,
            periodMonth: month,
            amount:      PLAN_AMOUNTS[t.plan] ?? 12900,
            dueDate,
            status:      "pending",
          },
        },
        upsert: true,
      },
    }));

    const result = await Payment.bulkWrite(ops);
    return NextResponse.json({ created: result.upsertedCount });
  }

  // Create single payment
  const { tenantId, periodYear, periodMonth, amount, dueDate } = body;
  if (!tenantId || !periodYear || !periodMonth) {
    return NextResponse.json({ error: "tenantId, periodYear, periodMonth requeridos" }, { status: 400 });
  }

  const tenant = await Tenant.findById(tenantId).lean() as { name: string; slug: string; plan: string } | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  const payment = await Payment.findOneAndUpdate(
    { tenantId, periodYear, periodMonth },
    {
      $setOnInsert: {
        tenantId, tenantName: tenant.name, tenantSlug: tenant.slug,
        plan: tenant.plan, periodYear, periodMonth,
        amount: amount ?? PLAN_AMOUNTS[tenant.plan] ?? 12900,
        dueDate: dueDate ? new Date(dueDate) : new Date(periodYear, periodMonth - 1, 1),
        status: "pending",
      },
    },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ payment }, { status: 201 });
}
