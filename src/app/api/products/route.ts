import { NextResponse } from "next/server";

// Endpoint heredado de antes del multi-tenant, sin sesión: el GET listaba los productos de TODOS
// los negocios (costo incluido) y el POST {action:"seed"} borraba el catálogo completo de la base.
// Nada en la app lo usa —la tienda carga sus productos del lado del servidor—, así que queda cerrado.
// Sin POST exportado, Next responde 405 a cualquier escritura.
export function GET() {
  return NextResponse.json({ error: "No disponible" }, { status: 410 });
}
