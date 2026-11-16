/**
 * Imprimir etiquetas directo en la impresora de etiquetas del agente de esta compu, sin ventana de
 * impresión. Si el agente no está, no tiene impresora de etiquetas o falla, quien llama imprime por
 * la ventana del navegador. Solo para componentes "use client".
 */
import { renderLabelPngBase64 } from "@/lib/labelPng";
import { AGENT_MAX_LABEL_COPIES, checkAgent, printLabelPng } from "@/lib/printBridge";
import type { LabelRowValues, ProductLabelFormat } from "@/lib/productLabel";

/** /health tarda unos segundos (enumera impresoras): la respuesta se recuerda un rato. */
const READY_TTL_MS = 60_000;
let ready: { at: number; ok: boolean } | null = null;

async function labelPrinterReady(): Promise<boolean> {
  if (ready && Date.now() - ready.at < READY_TTL_MS) return ready.ok;
  const health = await checkAgent();
  ready = { at: Date.now(), ok: !!health?.etiqueta?.disponible };
  return ready.ok;
}

export type AgentLabelOutcome =
  /** Se imprimieron todas. */
  | { status: "printed"; printed: number; test: boolean }
  /** No se imprimió ninguna por el agente: imprimir por la ventana del navegador. */
  | { status: "fallback"; reason?: string }
  /** Se cortó a medias (más de 100 van en varias tandas): no se reintenta para no duplicar. */
  | { status: "partial"; printed: number; reason: string };

export async function printLabelsWithAgent(
  format: ProductLabelFormat,
  code: string,
  values: LabelRowValues | undefined,
  copies: number,
): Promise<AgentLabelOutcome> {
  if (!(await labelPrinterReady())) return { status: "fallback" };
  let png: string;
  try {
    png = renderLabelPngBase64(format, code, values);
  } catch {
    return { status: "fallback" };
  }
  let printed = 0;
  let test = false;
  while (printed < copies) {
    const batch = Math.min(AGENT_MAX_LABEL_COPIES, copies - printed);
    let reason: string;
    try {
      const r = await printLabelPng(png, batch);
      if (r.ok) {
        printed += batch;
        test ||= !!r.modoPrueba;
        continue;
      }
      reason = r.mensaje || "La impresora de etiquetas no respondió";
    } catch {
      reason = "El agente de impresión no respondió";
    }
    // Que la próxima vez se vuelva a preguntar al agente en vez de dar por buena la impresora.
    ready = null;
    return printed === 0 ? { status: "fallback", reason } : { status: "partial", printed, reason };
  }
  return { status: "printed", printed, test };
}
