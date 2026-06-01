import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { getSession } from "@/lib/auth";

function parseBool(val: unknown, fallback: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "si" || v === "sí") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  if (typeof val === "number") return val !== 0;
  return fallback;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function get(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["json", "csv", "xlsx", "xls"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Formato no soportado. Usa JSON, CSV o Excel (.xlsx/.xls)" }, { status: 400 });
  }

  let rows: Record<string, unknown>[];
  try {
    if (ext === "json") {
      const text = await file.text();
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    }
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo. Verificá que el formato sea correcto." }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "El archivo está vacío o no tiene filas válidas." }, { status: 400 });
  }

  await connectToDatabase();

  const docs: Record<string, unknown>[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +2: header row is 1, data starts at 2
    const name        = String(get(row, "nombre", "name") ?? "").trim();
    const description = String(get(row, "descripcion", "description") ?? "").trim();
    const priceRaw    = get(row, "precio_venta", "precio", "price");
    const category    = String(get(row, "categoria", "category") ?? "").trim();

    if (!name)     { errors.push(`Fila ${rowNum}: falta el campo "nombre"`); return; }
    if (!category) { errors.push(`Fila ${rowNum}: falta el campo "categoria"`); return; }

    const price = parseNum(priceRaw, -1);
    if (price < 0) { errors.push(`Fila ${rowNum}: "precio_venta" inválido (valor: ${priceRaw})`); return; }

    const VALID_SECTIONS = ["panaderia", "bebidas", ""];
    const menuSectionRaw = String(get(row, "seccion_menu", "menuSection") ?? "").trim().toLowerCase();
    const menuSection = VALID_SECTIONS.includes(menuSectionRaw) ? menuSectionRaw : "panaderia";

    // Toppings: string separado por "|" o array
    let toppings: string[] = [];
    const tRaw = get(row, "toppings", "ingredientes");
    if (typeof tRaw === "string" && tRaw.trim()) {
      toppings = tRaw.split("|").map((t) => t.trim()).filter(Boolean);
    } else if (Array.isArray(tRaw)) {
      toppings = tRaw.map(String).filter(Boolean);
    }

    docs.push({
      tenantId:     new mongoose.Types.ObjectId(session.tenantId),
      name,
      description,
      price,
      cost:         parseNum(get(row, "precio_costo", "cost"), 0),
      category,
      menuSection,
      image:        String(get(row, "imagen", "image") ?? ""),
      toppings,
      stock:        parseNum(get(row, "stock"), 0),
      available:    parseBool(get(row, "disponible", "available"), true),
      featured:     parseBool(get(row, "destacado", "featured"), false),
      delivery:     parseBool(get(row, "delivery"), false),
      deliveryNote: String(get(row, "nota_delivery", "deliveryNote") ?? ""),
      images:       [],
      offers:       [],
      sold:         0,
    });
  });

  let imported = 0;
  if (docs.length > 0) {
    try {
      // insertMany con ordered:false continúa aunque fallen documentos individuales
      const result = await Product.insertMany(docs, { ordered: false, lean: true });
      imported = Array.isArray(result) ? result.length : docs.length;
    } catch (err: unknown) {
      // Con ordered:false, algunos pueden haberse insertado incluso si hay errores
      if (err && typeof err === "object" && "insertedDocs" in err) {
        const bulkErr = err as { insertedDocs: unknown[]; writeErrors?: { errmsg?: string }[] };
        imported = bulkErr.insertedDocs?.length ?? 0;
        (bulkErr.writeErrors ?? []).forEach((we) => {
          errors.push(we.errmsg ?? "Error al insertar documento");
        });
      } else {
        return NextResponse.json({ error: "Error interno al guardar los productos." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    imported,
    skipped: rows.length - imported,
    errors,
  });
}
