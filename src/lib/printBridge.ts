/**
 * printBridge.ts — cliente HTTP para vfprintagent (http://localhost:9100).
 *
 * IMPORTANTE: solo debe importarse desde componentes "use client".
 * Vercel/servidor no puede alcanzar la impresora local; toda llamada
 * ocurre en el navegador de la portátil que tiene la impresora conectada.
 *
 * Endpoints del agente (v1.1):
 *   GET  /health   — no requiere auth
 *   POST /imprimir — venta (auth opcional via Bearer / X-Agent-Token)
 *   POST /cierre   — reporte de cierre   (TODO: migrar buildCashClosePayload aquí)
 *   POST /cajon    — abrir cajón sin imprimir (TODO: migrar openCashDrawer aquí)
 *
 * Para ventas mandamos el SaleTicketData COMPLETO: el agente reproduce la misma
 * distribución que el PDF. El cajón se abre con openDrawer:true en el payload.
 */

import type { SaleTicketData, CashCloseTicketData, TicketConfigData } from "./ticket";

// ── Configuración (variables de entorno NEXT_PUBLIC_) ────────────────────────

const AGENT_URL = process.env.NEXT_PUBLIC_PRINT_AGENT_URL ?? "http://localhost:9100";
const AGENT_TOKEN = process.env.NEXT_PUBLIC_PRINT_AGENT_TOKEN ?? "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (AGENT_TOKEN) h["Authorization"] = `Bearer ${AGENT_TOKEN}`;
  return h;
}

// ── Tipos del agente (coinciden exactamente con el esquema de vfprintagent) ──

export interface AgentHealth {
  ok: true;
  servicio: string;
  version: string;
  estado: "activo";
  plataforma: string;
  transporte: string;
  modoPrueba: boolean;
  impresoraConfigurada: string | null;
  impresoraDisponible: boolean;
  estadoImpresora: string | null;
  anchoCaracteres: number;
  characterSet: string;
  autenticacion: boolean;
  impresoras: string[];
  hora: string;
}

export interface AgentError {
  ok: false;
  codigo: string;
  mensaje: string;
  detalles?: { errores: string[] };
}

export type AgentPrintResult =
  | { ok: true; mensaje: string; bytes: number; transporte: string; modoPrueba: boolean }
  | AgentError;

/** Payload exacto que acepta POST /imprimir en vfprintagent. */
export interface PrintItem {
  nombre: string;
  cantidad: number;        // > 0
  precioUnitario: number;  // >= 0
  subtotal?: number;       // opcional — si se omite, se calcula como cantidad * precioUnitario
}

export interface PrintReceiptPayload {
  negocio: {
    nombre: string;           // REQUERIDO — non-empty
    cedulaJuridica?: string;
    direccion?: string;
    telefono?: string;
  };
  items: PrintItem[];         // REQUERIDO — al menos 1 elemento
  totales: {
    total: number;            // REQUERIDO — finite numeric (puede ser negativo)
    subtotal?: number;
    impuestos?: number;       // solo se imprime si > 0
  };
  pago: {
    metodo: string;           // REQUERIDO — non-empty
    recibido?: number;
    vuelto?: number;          // si se omite y recibido está presente, se calcula
  };
  numeroRecibo?: string | number;
  fecha?: string;             // ISO 8601; si se omite usa now
  piePagina?: string;
  qr?: string;
  abrirGaveta?: boolean;      // debe ser boolean, no string
  openDrawer?: boolean;       // alias canónico de abrirGaveta en el agente v1.1
}

/**
 * Payload en formato ticket.ts: el SaleTicketData COMPLETO + el TicketConfigData
 * en `config`. El agente v1.1 lo detecta y lo mapea, reproduciendo la misma
 * distribución que el PDF (Encargado, Cliente, Mesa, desglose de impuestos, etc.).
 */
export type SaleAgentPayload = SaleTicketData & {
  config: TicketConfigData;
  openDrawer?: boolean;
};

/**
 * Payload de cierre que acepta POST /cierre (CashCloseTicketData + config). El
 * `arqueo` incluye las denominaciones contadas (que el tipo base no lleva).
 */
export type CashCloseAgentPayload = Omit<CashCloseTicketData, "arqueo"> & {
  docType: "cierre";
  config: TicketConfigData;
  arqueo?: {
    totalContado: number;
    totalEsperado: number;
    diferencia: number;
    denominaciones?: { valor: number; cantidad: number; subtotal: number }[];
  };
};

/** Cualquier payload que acepta el agente (schema v1, venta ticket.ts, o cierre). */
export type AgentPayload = PrintReceiptPayload | SaleAgentPayload | CashCloseAgentPayload;

// ── Funciones de API ─────────────────────────────────────────────────────────

/** Verifica que el agente esté corriendo. Retorna null si no responde (timeout 3s). */
export async function checkAgent(): Promise<AgentHealth | null> {
  try {
    const res = await fetch(`${AGENT_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? (data as AgentHealth) : null;
  } catch {
    return null;
  }
}

/** Envía un recibo a la impresora térmica via POST /imprimir. */
export async function printReceipt(payload: AgentPayload): Promise<AgentPrintResult> {
  const res = await fetch(`${AGENT_URL}/imprimir`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  return res.json() as Promise<AgentPrintResult>;
}

/** Imprime el reporte de cierre de caja via POST /cierre (reporte formateado por el agente). */
export async function printCierre(payload: AgentPayload): Promise<AgentPrintResult> {
  const res = await fetch(`${AGENT_URL}/cierre`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  return res.json() as Promise<AgentPrintResult>;
}

/** Abre el cajón monedero SIN imprimir, via POST /cajon. */
export async function printCajon(): Promise<AgentPrintResult> {
  const res = await fetch(`${AGENT_URL}/cajon`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  return res.json() as Promise<AgentPrintResult>;
}

/** Alias retro-compatible: abre el cajón (ahora via el endpoint real /cajon). */
export async function openCashDrawer(): Promise<AgentPrintResult> {
  return printCajon();
}

// ── Constructores de payload ──────────────────────────────────────────────────

/**
 * Construye el payload de venta para POST /imprimir (formato ticket.ts completo).
 * @param openDrawer  true → abre el cajón junto con la impresión
 */
export function buildSalePayload(
  sale: SaleTicketData,
  cfg: TicketConfigData,
  openDrawer = false,
): SaleAgentPayload {
  // Mandamos el SaleTicketData COMPLETO + config: el agente v1.1 lo acepta y
  // reproduce la MISMA distribución que el PDF (Encargado, Cliente, Mesa,
  // desglose de impuestos, pie, etc.). No recortamos campos.
  return { ...sale, config: cfg, openDrawer: openDrawer || undefined };
}

/**
 * Construye el payload de cierre para POST /cierre: el CashCloseTicketData
 * COMPLETO + config, con las denominaciones contadas dentro de `arqueo`. El
 * agente lo formatea igual que el PDF (buildCashCloseRows) + el desglose de
 * denominaciones bajo "Contado".
 * @param denominaciones  conteos físicos de billetes/monedas (del arqueo actual)
 */
export function buildCashClosePayload(
  data: CashCloseTicketData,
  cfg: TicketConfigData,
  denominaciones?: { valor: number; cantidad: number; subtotal: number }[],
): CashCloseAgentPayload {
  const denoms = denominaciones?.filter((d) => d.cantidad > 0);
  let arqueo: CashCloseAgentPayload["arqueo"];
  if (data.arqueo) {
    arqueo = { ...data.arqueo, denominaciones: denoms };
  } else if (denoms && denoms.length) {
    arqueo = {
      totalContado: denoms.reduce((s, d) => s + d.subtotal, 0),
      totalEsperado: 0,
      diferencia: 0,
      denominaciones: denoms,
    };
  }
  return { docType: "cierre", ...data, config: cfg, arqueo };
}

/** Imprime el cierre de caja en la térmica, via el endpoint real POST /cierre. */
export async function printCashClose(
  data: CashCloseTicketData,
  cfg: TicketConfigData,
  denominaciones?: { valor: number; cantidad: number; subtotal: number }[],
): Promise<AgentPrintResult> {
  return printCierre(buildCashClosePayload(data, cfg, denominaciones));
}
