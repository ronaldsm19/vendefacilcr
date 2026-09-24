import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ProductClick } from "@/models/ProductClick";
import { Product } from "@/models/Product";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false });

    await connectToDatabase();

    // El click le pertenece al tenant dueño del producto; el nombre se denormaliza para el dashboard
    const product = await Product.findById(id).select("name tenantId").lean() as
      { name: string; tenantId?: mongoose.Types.ObjectId } | null;
    if (!product?.tenantId) return NextResponse.json({ ok: false });

    await ProductClick.create({
      tenantId: product.tenantId,
      productId: id,
      productName: product.name,
      timestamp: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Nunca fallar hacia el cliente — el tracking no debe interrumpir la UX — pero sí dejar rastro en el log
    console.error("[POST /api/products/[id]/click]", error);
    return NextResponse.json({ ok: false });
  }
}
