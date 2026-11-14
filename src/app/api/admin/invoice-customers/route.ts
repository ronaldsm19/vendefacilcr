import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer, type ICustomer } from "@/models/Customer";
import { getSession, requireFeature } from "@/lib/auth";
import { requirePlan } from "@/lib/plan";
import { escapeRegex, normalizeIdNumber, searchKey } from "@/lib/customerId";
import { isDuplicateKey, parseCustomerInput, toCustomerView } from "@/server/services/customers";

// Registro de clientes que piden factura. Va aparte de /api/admin/customers, que es el
// autocompletado de nombres de Pedidos (sale de los pedidos anotados, no de este registro).

const PAGE_SIZES = [15, 30, 50];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "clientes");
  if (denied) return denied;
  const deniedPlan = await requirePlan(session, "clientes");
  if (deniedPlan) return deniedPlan;

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const askedSize = Math.floor(Number(params.get("pageSize")) || PAGE_SIZES[0]);
  const pageSize = PAGE_SIZES.includes(askedSize) ? askedSize : PAGE_SIZES[0];

  const filter: Record<string, unknown> = { tenantId: session.tenantId };
  if (q) {
    // Sin letras = la caja está escribiendo una cédula (con o sin guiones): se busca por el inicio.
    const digits = normalizeIdNumber(q);
    if (!/[a-zA-ZÀ-ÿ@]/.test(q) && digits) {
      filter.idNumber = { $regex: `^${digits}` };
    } else {
      const key = escapeRegex(searchKey(q));
      filter.$or = [
        { searchName: { $regex: key } },
        { email: { $regex: escapeRegex(q.toLowerCase()) } },
      ];
    }
  }

  await connectToDatabase();
  const [docs, total] = await Promise.all([
    Customer.find(filter)
      .sort({ lastInvoiceAt: -1, updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<ICustomer[]>(),
    Customer.countDocuments(filter),
  ]);

  return NextResponse.json({
    customers: docs.map(toCustomerView),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "clientes");
  if (denied) return denied;
  const deniedPlan = await requirePlan(session, "clientes");
  if (deniedPlan) return deniedPlan;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const parsed = parseCustomerInput(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectToDatabase();

  // Si la cédula ya está registrada se devuelve ese cliente, para que la caja lo use en vez de
  // quedarse con un error.
  const duplicate = async () => {
    const existing = await Customer.findOne({
      tenantId: session.tenantId, idType: parsed.data.idType, idNumber: parsed.data.idNumber,
    }).lean<ICustomer>();
    return NextResponse.json(
      {
        error: "Ese cliente ya está registrado",
        code: "CUSTOMER_EXISTS",
        customer: existing ? toCustomerView(existing) : null,
      },
      { status: 409 },
    );
  };

  if (await Customer.exists({ tenantId: session.tenantId, idType: parsed.data.idType, idNumber: parsed.data.idNumber })) {
    return duplicate();
  }

  try {
    const created = await Customer.create({
      ...parsed.data,
      tenantId: session.tenantId,
      createdBy: session.name.slice(0, 60),
    });
    return NextResponse.json({ customer: toCustomerView(created.toObject()) }, { status: 201 });
  } catch (err) {
    // Dos cajas registrando la misma cédula al mismo tiempo: la segunda choca con el índice único.
    if (isDuplicateKey(err)) return duplicate();
    throw err;
  }
}
