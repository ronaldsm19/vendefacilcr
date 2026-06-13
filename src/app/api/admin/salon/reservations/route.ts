import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonReservation } from "@/models/SalonReservation";
import { SalonTable } from "@/models/SalonTable";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get("tableId");

  const query: Record<string, unknown> = { tenantId: session.tenantId, status: "confirmed" };
  if (tableId) query.tableId = tableId;

  const reservations = await SalonReservation.find(query).sort({ dateTime: 1 }).lean();
  return NextResponse.json({ reservations });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await connectToDatabase();
  const { tableId, customerName, partySize, dateTime, phone, notes } = await request.json();
  if (!tableId || !customerName || !dateTime)
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });

  const reservation = await SalonReservation.create({
    tenantId: session.tenantId,
    tableId,
    customerName,
    partySize: partySize ?? 1,
    dateTime: new Date(dateTime),
    phone: phone ?? "",
    notes: notes ?? "",
    status: "confirmed",
  });

  // Mark table as reserved
  await SalonTable.updateOne(
    { _id: tableId, tenantId: session.tenantId },
    { $set: { status: "reservada", statusNote: customerName } }
  );

  return NextResponse.json({ reservation }, { status: 201 });
}
