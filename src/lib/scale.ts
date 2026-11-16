/**
 * Lectura de la báscula desde el navegador, a través del agente de impresión de esta compu
 * (GET /peso). Solo para componentes "use client".
 */
import { readScale } from "@/lib/printBridge";

export interface ScaleResult {
  /** Peso leído en kilos, si se pudo leer algo mayor que cero. */
  kg?: number;
  tone: "ok" | "warn" | "error";
  text: string;
}

/** Lee la báscula y devuelve el peso con un mensaje listo para mostrar. Nunca lanza. */
export async function readScaleKg(): Promise<ScaleResult> {
  try {
    const r = await readScale();
    if (!r.ok) {
      return {
        tone: "error",
        text: r.codigo === "NO_ENCONTRADO"
          ? "El agente de impresión de esta compu todavía no lee básculas: hay que actualizarlo."
          : r.mensaje || "El agente no pudo leer la báscula",
      };
    }
    if (!r.disponible) return { tone: "error", text: r.motivo || "La báscula no está conectada al agente" };
    if (!(r.pesoKg > 0)) return { tone: "warn", text: "La báscula marca 0: poné el producto encima" };
    const kg = Math.round(r.pesoKg * 1000) / 1000;
    return r.estable
      ? { kg, tone: "ok", text: "Peso leído de la báscula" }
      : { kg, tone: "warn", text: "La báscula todavía se movía: revisá el peso" };
  } catch {
    return { tone: "error", text: "No se pudo hablar con el agente de impresión. ¿Está abierto en esta compu?" };
  }
}

/** Peso en el formato de los campos de texto: "0,350". */
export function kgInputText(kg: number): string {
  return kg.toFixed(3).replace(".", ",");
}
