import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer, type ICustomer } from "@/models/Customer";
import { getSession, requireFeature, requireRole, type AdminPayload } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { isDuplicateKey, parseCustomerInput, toCustomerView } from "@/server/services/customers";

type Ctx = { params: Promise<{ id: string }> };

async function gate(request: NextRequest): Promise<{ session: AdminPayload } | { response: NextResponse }> {
  const session = await getSession(request);
  if (!session) return { response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const denied = requireFeature(session, "clientes");
  if (denied) return { response: denied };
  const deniedPlan = await requirePlan(session, "clientes");
  if (deniedPlan) return { response: deniedPlan };
  return { session };
}

const notFound = () => NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

export async function GET(request: NextRequest, { params }: Ctx) {
  const g = await gate(request);
  if ("response" in g) return g.response;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  await connectToDatabase();
  const doc = await Customer.findOne({ _id: id, tenantId: g.session.tenantId }).lean<ICustomer>();
  if (!doc) return notFound();
  return NextResponse.json({ customer: toCustomerView(doc) });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const g = await gate(request);
  if ("response" in g) return g.response;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const parsed = parseCustomerInput(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "No hay cambios" }, { status: 400 });

  await connectToDatabase();
  const filter = { _id: id, tenantId: g.session.tenantId };

  // Las copias no pueden repetir el correo principal, sea el nuevo o el que ya tenía.
  if (parsed.data.ccEmails) {
    const email = parsed.data.email ?? (await Customer.findOne(filter).select("email").lean<{ email: string }>())?.email;
    parsed.data.ccEmails = parsed.data.ccEmails.filter((e) => e !== email);
  }

  try {
    const doc = await Customer.findOneAndUpdate(filter, { $set: parsed.data }, { returnDocument: "after", runValidators: true })
      .lean<ICustomer>();
    if (!doc) return notFound();
    return NextResponse.json({ customer: toCustomerView(doc) });
  } catch (err) {
    if (isDuplicateKey(err)) {
      return NextResponse.json({ error: "Ya hay otro cliente con esa identificación" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const g = await gate(request);
  if ("response" in g) return g.response;
  // Borrar es de la dueña. Las ventas facturadas guardan su propia copia de los datos.
  const deniedRole = requireRole(g.session, "admin");
  if (deniedRole) return deniedRole;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  await connectToDatabase();
  const res = await Customer.deleteOne({ _id: id, tenantId: g.session.tenantId });
  if (res.deletedCount === 0) return notFound();
  return NextResponse.json({ ok: true });
}
