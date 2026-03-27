import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ProductClick } from "@/models/ProductClick";
import { Product } from "@/models/Product";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    // Buscar nombre del producto para denormalizarlo
    const product = await Product.findById(id).select("name").lean();
    const productName = (product as { name?: string } | null)?.name ?? "Producto desconocido";

    await ProductClick.create({
      productId: id,
      productName,
      timestamp: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Silenciar errores — el tracking no debe interrumpir la UX
    return NextResponse.json({ ok: false });
  }
}
