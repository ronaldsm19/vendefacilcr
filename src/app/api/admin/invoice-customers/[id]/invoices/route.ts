import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale, type ISale } from "@/models/Sale";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { summarizeInvoice } from "@/lib/saleReceipt";

// Comprobantes de un cliente (las últimas ventas facturadas a su nombre), para el detalle en Clientes.

const LIMIT = 50;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "clientes");
  if (denied) return denied;
  const deniedPlan = await requirePlan(session, "clientes");
  if (deniedPlan) return deniedPlan;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ invoices: [] });

  await connectToDatabase();
  const sales = await Sale.find({ tenantId: session.tenantId, customerId: id })
    .select("ticketNumber saleDate total invoice")
    .sort({ saleDate: -1 })
    .limit(LIMIT)
    .lean<Pick<ISale, "_id" | "ticketNumber" | "saleDate" | "total" | "invoice">[]>();

  return NextResponse.json({
    invoices: sales.map((s) => ({
      saleId: String(s._id),
      ticketNumber: s.ticketNumber,
      date: new Date(s.saleDate).toISOString(),
      total: s.total,
      invoice: summarizeInvoice(s.invoice),
    })),
  });
}
