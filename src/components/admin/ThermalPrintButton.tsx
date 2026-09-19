"use client";

import { useState } from "react";
import { Printer, Loader2, Check, AlertCircle } from "lucide-react";
import { checkAgent, printReceipt, type AgentPayload, type AgentPrintResult } from "@/lib/printBridge";

type PrintState = "idle" | "checking" | "printing" | "success" | "no-agent" | "error";

interface Props {
  /** Retorna el payload para el agente. Puede ser async. */
  getPayload: () => AgentPayload | Promise<AgentPayload>;
  /** Función de envío al agente (por defecto printReceipt → /imprimir). Para cierre: printCierre → /cierre. */
  printFn?: (payload: AgentPayload) => Promise<AgentPrintResult>;
  label?: string;
  /** Clases extra para el botón en estado idle/success (se ignoran en los estados inline). */
  className?: string;
  /** Se llama si el usuario elige "Usar PDF" cuando el agente no responde. */
  onPdfFallback?: () => void;
  disabled?: boolean;
}

export default function ThermalPrintButton({
  getPayload,
  printFn = printReceipt,
  label = "Imprimir en térmica",
  className = "",
  onPdfFallback,
  disabled = false,
}: Props) {
  const [state, setState] = useState<PrintState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handlePrint() {
    if (disabled) return;
    setState("checking");
    const health = await checkAgent();
    if (!health) {
      setState("no-agent");
      return;
    }
    setState("printing");
    try {
      const payload = await getPayload();
      const result = await printFn(payload);
      if (result.ok) {
        setState("success");
        setTimeout(() => setState("idle"), 3000);
      } else {
        const detalle = result.detalles?.errores?.length
          ? `: ${result.detalles.errores.join("; ")}`
          : "";
        setErrorMsg(`${result.mensaje}${detalle}`);
        setState("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error de conexión con el agente");
      setState("error");
    }
  }

  // ── Estado: agente no disponible ──────────────────────────────────────────
  if (state === "no-agent") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs">
        <div className="flex items-start gap-2 text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">vfprintagent no está activo</p>
            <p className="text-amber-600 mt-0.5 leading-snug">
              El agente de impresión no responde en esta computadora.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-2 ml-5">
          {onPdfFallback && (
            <button
              type="button"
              onClick={() => { setState("idle"); onPdfFallback(); }}
              className="font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Usar PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => setState("idle")}
            className="font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Estado: error de impresión ────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs">
        <div className="flex items-start gap-2 text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Error al imprimir</p>
            <p className="text-red-600 mt-0.5 leading-snug">{errorMsg}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 mt-2 ml-5"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Estado normal: idle / checking / printing / success ───────────────────
  const busy = state === "checking" || state === "printing";

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={busy || disabled}
      className={`flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        state === "success"
          ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border border-brand-muted bg-white text-brand-dark/70 hover:border-brand-pink/40 hover:bg-brand-pink/5"
      } ${className}`}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : state === "success" ? (
        <Check className="w-4 h-4 shrink-0" />
      ) : (
        <Printer className="w-4 h-4 shrink-0" />
      )}
      {state === "checking"
        ? "Verificando..."
        : state === "printing"
          ? "Imprimiendo..."
          : state === "success"
            ? "Impreso"
            : label}
    </button>
  );
}
