import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mediaType = (file.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Analiza esta factura o recibo y extrae los datos en formato JSON.
Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin bloques de código.

Campos requeridos:
- title: nombre del negocio o proveedor de la factura
- date: fecha en formato YYYY-MM-DD (si no aparece, usa la fecha de hoy)
- category: clasifica en una de estas: "materia_prima" (ingredientes, comida, leche, harina, etc), "empaque" (bolsas, cajas, envases), "herramientas" (utensilios, equipo), "marketing" (publicidad, diseño), "otros"
- items: arreglo de objetos con "description" (nombre del producto) y "amount" (monto TOTAL de esa línea como número, sin puntos ni comas)
- notes: cualquier observación relevante (número de comprobante, proveedor, etc.) o cadena vacía

Ejemplo de respuesta:
{"title":"La Cocina Creativa","date":"2026-03-25","category":"materia_prima","items":[{"description":"ESPATULA BLANCA 10","amount":1400},{"description":"LECHE CONDENSADA HAPPY x4","amount":4100}],"notes":"Comprobante: 0010000010400000306648"}`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    let parsed: {
      title: string;
      date: string;
      category: string;
      items: { description: string; amount: number }[];
      notes: string;
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "No se pudo parsear la respuesta del modelo", raw }, { status: 422 });
    }

    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error("parse-receipt error:", err);
    return NextResponse.json({ error: "Error al analizar la imagen" }, { status: 500 });
  }
}
