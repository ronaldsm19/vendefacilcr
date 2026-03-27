import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  try {
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) throw new Error("Sin referencia a la DB");

    // Listar colecciones existentes
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    return NextResponse.json({
      status: "ok",
      database: db.databaseName,
      collections: collectionNames,
      mongoose: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
