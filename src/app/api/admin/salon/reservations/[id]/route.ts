import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SalonReservation } from "@/models/SalonReservation";
import { SalonTable } from "@/models/SalonTable";
import { getSession } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const { status, customerName, partySize, dateTime, phone, notes } = await request.json();

  const reservation = await SalonReservation.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { $set: { status, customerName, partySize, dateTime: dateTime ? new Date(dateTime) : undefined, phone, notes } },
    { new: true }
  ).lean();
  if (!reservation) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // If cancelled, free the table
  if (status === "cancelled") {
    await SalonTable.updateOne(
      { _id: reservation.tableId, tenantId: session.tenantId },
      { $set: { status: "libre", statusNote: "" } }
    );
  }

  return NextResponse.json({ reservation });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await connectToDatabase();
  const reservation = await SalonReservation.findOneAndDelete({ _id: id, tenantId: session.tenantId });
  if (reservation) {
    await SalonTable.updateOne(
      { _id: reservation.tableId, tenantId: session.tenantId },
      { $set: { status: "libre", statusNote: "" } }
    );
  }
  return NextResponse.json({ ok: true });
}
