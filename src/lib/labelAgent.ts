/**
 * Imprimir etiquetas directo en la impresora de etiquetas del agente de esta compu, sin ventana de
 * impresión. Si el agente no está, no tiene impresora de etiquetas o falla, quien llama imprime por
 * la ventana del navegador y muestra el motivo. Solo para componentes "use client".
 */
import { renderLabelPngBase64 } from "@/lib/labelPng";
import {
  AGENT_MAX_LABEL_COPIES, checkAgentDetailed, localNetworkPermission, printLabelPng, type AgentHealth,
} from "@/lib/printBridge";
import type { LabelRowValues, ProductLabelFormat } from "@/lib/productLabel";

/** /health tarda unos segundos (enumera impresoras): cuando la impresora está lista se recuerda un rato. */
const READY_TTL_MS = 60_000;
let readyAt = 0;

const PERMISSION_HINT =
  "Chrome no deja que esta página hable con el agente de impresión de la compu. Tocá el ícono a la izquierda de la dirección → Acceso a la red local → Permitir, y volvé a imprimir.";

/** Por qué el agente que sí contestó no puede imprimir etiquetas (null = puede). */
export function labelPrinterProblem(health: AgentHealth): string | null {
  const label = health.etiqueta;
  if (!label) return `El agente de esta compu (versión ${health.version}) todavía no imprime etiquetas: hay que actualizarlo a la 1.4.0.`;
  if (!label.configurada) return "El agente de impresión no tiene configurada una impresora de etiquetas.";
  if (!label.disponible) return `La impresora de etiquetas "${label.configurada}" no está lista${label.estado ? ` (${label.estado})` : ""}.`;
  return null;
}

/** Si la impresora de etiquetas del agente está lista o, si no, por qué. */
async function labelPrinterStatus(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (Date.now() - readyAt < READY_TTL_MS) return { ok: true };
  if ((await localNetworkPermission()) === "denied") return { ok: false, reason: PERMISSION_HINT };
  const r = await checkAgentDetailed();
  if ("failure" in r) {
    // Sin respuesta: o el agente no está abierto, o Chrome está esperando (o negó) el permiso de red local.
    const permission = await localNetworkPermission();
    if (permission === "denied" || permission === "prompt") return { ok: false, reason: PERMISSION_HINT };
    return {
      ok: false,
      reason: r.failure === "timeout"
        ? "El agente de impresión no contestó a tiempo. Si Chrome preguntó por acceso a la red local, tocá Permitir."
        : "No se encontró el agente de impresión en esta compu. Revisá que esté abierto.",
    };
  }
  const problem = labelPrinterProblem(r.health);
  if (problem) return { ok: false, reason: problem };
  readyAt = Date.now();
  return { ok: true };
}

export type AgentLabelOutcome =
  /** Se imprimieron todas. */
  | { status: "printed"; printed: number; test: boolean }
  /** No se imprimió ninguna por el agente: imprimir por la ventana del navegador. */
  | { status: "fallback"; reason: string }
  /** Se cortó a medias (más de 100 van en varias tandas): no se reintenta para no duplicar. */
  | { status: "partial"; printed: number; reason: string };

export async function printLabelsWithAgent(
  format: ProductLabelFormat,
  code: string,
  values: LabelRowValues | undefined,
  copies: number,
): Promise<AgentLabelOutcome> {
  const status = await labelPrinterStatus();
  if (!status.ok) return { status: "fallback", reason: status.reason };
  let png: string;
  try {
    png = renderLabelPngBase64(format, code, values);
  } catch {
    return { status: "fallback", reason: "No se pudo dibujar la etiqueta para el agente" };
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
    readyAt = 0;
    return printed === 0 ? { status: "fallback", reason } : { status: "partial", printed, reason };
  }
  return { status: "printed", printed, test };
}
