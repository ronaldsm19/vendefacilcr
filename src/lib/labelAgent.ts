/**
 * Imprimir etiquetas directo en la impresora de etiquetas del agente de esta compu, sin ventana de
 * impresión. Si el agente no está, no tiene impresora de etiquetas o rechaza la etiqueta, quien
 * llama imprime por la ventana del navegador y muestra el motivo. Solo para componentes "use client".
 *
 * No se pregunta antes a /health: en compus lentas tarda más de 10 s (lanza PowerShell tres veces
 * para revisar impresoras). Se manda directo a POST /etiqueta y la respuesta del agente dice si se
 * pudo: sin agente la llamada falla al instante, y un agente sin etiquetadora contesta con el error.
 */
import { renderLabelPngBase64 } from "@/lib/labelPng";
import { AGENT_MAX_LABEL_COPIES, localNetworkPermission, printLabelPng, type AgentLabelResult } from "@/lib/printBridge";
import type { LabelRowValues, ProductLabelFormat } from "@/lib/productLabel";

const PERMISSION_HINT =
  "Chrome no deja que esta página hable con el agente de impresión de la compu. Tocá el ícono a la izquierda de la dirección → Aplicaciones en el dispositivo (o Acceso a la red local) → Permitir, y volvé a imprimir.";

/** Por qué el agente rechazó la etiqueta, en palabras del usuario. */
export function labelRejectReason(r: Extract<AgentLabelResult, { ok: false }>): string {
  switch (r.codigo) {
    case "NO_ENCONTRADO":
      return "El agente de impresión de esta compu todavía no imprime etiquetas: hay que actualizarlo a la 1.4.0.";
    case "ETIQUETA_IMPRESORA_NO_CONFIGURADA":
      return "El agente de impresión no tiene configurada una impresora de etiquetas.";
    case "ORIGEN_NO_PERMITIDO":
      return "El agente de impresión no acepta pedidos de esta página: hay que agregar este dominio en su configuración.";
    case "NO_AUTORIZADO":
      return "El agente de impresión pide un código de acceso que esta página no tiene.";
    default:
      return cleanAgentMessage(r.mensaje) || "La impresora de etiquetas no respondió";
  }
}

const MAX_MESSAGE = 200;

/**
 * El mensaje del agente sin la basura técnica que a veces arrastra de PowerShell: el comando en
 * base64 y la salida "#< CLIXML" (pasa cuando PowerShell se cuelga y el agente lo corta).
 */
export function cleanAgentMessage(raw: string | undefined): string {
  if (!raw) return "";
  const hadJunk = /#<\s*CLIXML|[A-Za-z0-9+/=]{40,}/.test(raw);
  let text = raw.split(/#<\s*CLIXML/)[0].replace(/\S*[A-Za-z0-9+/=]{40,}\S*/g, " ");
  text = text.replace(/Command failed:[\s\S]*$/, "").replace(/\s+/g, " ").replace(/[\s:;,-]+$/, "").trim();
  if (hadJunk) text = `${text || "La impresora de etiquetas falló"}: el agente no pudo terminar de imprimir (el driver de la impresora no respondió)`;
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 1)}…` : text;
}

export type AgentLabelOutcome =
  /** Se imprimieron todas. */
  | { status: "printed"; printed: number; test: boolean }
  /** No se imprimió ninguna por el agente: imprimir por la ventana del navegador. */
  | { status: "fallback"; reason: string }
  /** Se cortó a medias (más de 100 van en varias tandas): no se reintenta para no duplicar. */
  | { status: "partial"; printed: number; reason: string }
  /**
   * El agente recibió la etiqueta pero no confirmó a tiempo: puede que salga igual, así que no se
   * abre la ventana de impresión (saldría doble).
   */
  | { status: "unconfirmed"; printed: number };

export async function printLabelsWithAgent(
  format: ProductLabelFormat,
  code: string,
  values: LabelRowValues | undefined,
  copies: number,
): Promise<AgentLabelOutcome> {
  if ((await localNetworkPermission()) === "denied") return { status: "fallback", reason: PERMISSION_HINT };
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
      reason = labelRejectReason(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") return { status: "unconfirmed", printed };
      // Sin respuesta (no hay agente) o respuesta que no es JSON (no es el agente).
      if (printed > 0) return { status: "partial", printed, reason: "El agente de impresión dejó de responder" };
      const permission = await localNetworkPermission();
      return {
        status: "fallback",
        reason: permission === "prompt" ? PERMISSION_HINT : "No se encontró el agente de impresión en esta compu",
      };
    }
    return printed === 0 ? { status: "fallback", reason } : { status: "partial", printed, reason };
  }
  return { status: "printed", printed, test };
}
