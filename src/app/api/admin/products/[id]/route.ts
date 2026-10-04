import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession, requireFeature } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isStation } from "@/lib/station";
import { normalizeExtras } from "@/lib/pricing";
import { ensureExtrasMigrated } from "@/server/services/productExtras";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  await ensureExtrasMigrated(session.tenantId);
  // Mismo criterio que el listado: sin permiso de edición, el costo no viaja.
  const product = await Product.findOne({ _id: id, tenantId: session.tenantId })
    .select(can(session, "productos:editar") ? "-toppings" : "-toppings -cost")
    .lean();
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // La caja puede llegar acá para ajustar precio y extras; el resto de los campos es del dueño.
  const denied = requireFeature(session, "productos:precios");
  if (denied) return denied;
  const fullEdit = can(session, "productos:editar");

  const { id } = await params;
  await connectToDatabase();
  const body = await request.json();

  if (body.station !== undefined && !isStation(body.station)) {
    return NextResponse.json({ error: "Estación inválida" }, { status: 400 });
  }
  // Campos que el cuerpo nunca puede cambiar: el negocio dueño, la identidad y los toppings
  // obsoletos (reemplazados por extras).
  delete body.tenantId;
  delete body._id;
  delete body.toppings;

  // Sin permiso completo solo sobreviven precio y extras. Se descarta todo lo demás en vez de
  // rechazar la petición: la pantalla ya manda el producto entero y lo que importa es que un
  // campo que la caja no debería tocar no llegue a guardarse, aunque alguien arme la petición
  // a mano.
  if (!fullEdit) {
    for (const campo of Object.keys(body)) {
      if (campo !== "price" && campo !== "extras") delete body[campo];
    }
  }
  if (body.extras !== undefined) {
    const extras = normalizeExtras(body.extras);
    if (!extras) {
      return NextResponse.json({ error: "Extras inválidos: cada uno necesita nombre y un precio de 0 o más" }, { status: 400 });
    }
    body.extras = extras;
  }

  const product = await Product.findOneAndUpdate(
    { _id: id, tenantId: session.tenantId },
    { ...body, price: body.price ? Number(body.price) : undefined },
    { returnDocument: "after", runValidators: true }
  )
    // Igual que al leer: sin permiso completo el costo tampoco vuelve en la respuesta.
    .select(fullEdit ? "-toppings" : "-toppings -cost")
    .lean();

  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  const { stock } = await request.json();
  if (typeof stock !== "number" || stock < 0)
    return NextResponse.json({ error: "Stock inválido" }, { status: 400 });
  const product = await Product.findOneAndUpdate({ _id: id, tenantId: session.tenantId }, { stock }, { new: true, runValidators: true }).lean();
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();
  await Product.deleteOne({ _id: id, tenantId: session.tenantId });
  return NextResponse.json({ ok: true });
}
