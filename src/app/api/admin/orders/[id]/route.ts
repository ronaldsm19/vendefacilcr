import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession, requireFeature } from "@/lib/auth";
import { normalizeOrderItems } from "@/server/services/orderItems";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();
  // El negocio dueño y la identidad del pedido no se cambian desde el cuerpo.
  delete body.tenantId;
  delete body._id;
  if (body.items !== undefined) {
    const items = normalizeOrderItems(body.items);
    if (!items) return NextResponse.json({ error: "Extras inválidos en algún producto" }, { status: 400 });
    body.items = items;
  }

  const order = await Order.findOneAndUpdate({ _id: id, tenantId: session.tenantId }, body, { returnDocument: "after" }).lean();
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  await Order.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
