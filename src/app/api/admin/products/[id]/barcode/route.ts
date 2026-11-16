import { NextRequest, NextResponse } from "next/server";
import { getSession, requireFeature } from "@/lib/auth";
import { serviceErrorResponse } from "@/lib/serviceResponse";
import { setProductBarcode } from "@/server/services/productBarcodes";

/**
 * Asigna solo el código de barras de un producto: `{ barcode }` ("" lo quita). Lo usa la pantalla
 * de asignar códigos, que va producto por producto escaneando, sin mandar la ficha completa.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "productos:editar");
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const barcode = await setProductBarcode(session.tenantId, id, body.barcode);
    return NextResponse.json({ barcode });
  } catch (err) {
    return serviceErrorResponse(err);
  }
}
