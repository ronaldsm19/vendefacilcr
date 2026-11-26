import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

// Chequeo de vida público: solo dice si la app llega a la base. Antes devolvía el nombre de la
// base, la lista de colecciones y el mensaje de error crudo, todo útil para alguien que tantea.
export async function GET() {
  try {
    await connectToDatabase();
    const ok = mongoose.connection.readyState === 1;
    return NextResponse.json(
      { status: ok ? "ok" : "error" },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[GET /api/health]", error);
    return NextResponse.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
