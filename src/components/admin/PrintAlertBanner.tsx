"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import type { Role } from "@/lib/permissions";

export interface PrintAlert {
  pendingCount: number;
  oldestPendingAt: string;
  agentLastSeenAt: string | null;
}

function when(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `las ${time}`;
  return `el ${d.toLocaleDateString("es-CR", { day: "numeric", month: "numeric" })} a las ${time}`;
}

/** Qué hacer, según quién mira: la mesera no puede arreglar la PC, pero sí avisar y cantar el pedido. */
const WHAT_TO_DO: Record<Role, string> = {
  admin: "Reiniciá el programa de impresión en esa computadora. Las que ya no hagan falta se cancelan en Configuración → Comandas.",
  cajero: "Reiniciá el programa de impresión en la computadora de la caja.",
  mesero: "Avisá en caja y pasá el pedido a cocina de palabra.",
};

/**
 * Aviso de comandas que no se están imprimiendo: hay alguna esperando hace más de un minuto y el
 * agente de la PC no la tomó. Sin esto, un agente caído pasó días sin que nadie lo notara, porque
 * las ventas sí imprimen (van directo del navegador) y la cocina solo veía que no llegaba nada.
 */
export default function PrintAlertBanner({
  alert, role, slug, className = "",
}: {
  alert: PrintAlert | null;
  role: Role;
  slug: string;
  className?: string;
}) {
  if (!alert) return null;
  const { pendingCount, oldestPendingAt, agentLastSeenAt } = alert;
  const esperando = pendingCount === 1 ? "1 comanda esperando" : `${pendingCount} comandas esperando`;
  // Sin punto final: la hora en español ya termina en "p. m." y quedaría doble.
  const agent = agentLastSeenAt
    ? `El programa de impresión no se conecta desde ${when(agentLastSeenAt)}`
    : "El programa de impresión nunca se ha conectado";

  return (
    <div role="alert" className={`rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 ${className}`}>
      <div className="flex items-center gap-3">
        <Printer className="w-5 h-5 shrink-0 text-red-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-900">
            Las comandas no se están imprimiendo
            <span className="font-normal"> · {esperando} desde {when(oldestPendingAt)}</span>
          </p>
          <p className="text-[11px] text-red-800">{agent} · {WHAT_TO_DO[role]}</p>
        </div>
        {role === "admin" && (
          <Link
            href={`/${slug}/admin/configuracion`}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Ver cola
          </Link>
        )}
      </div>
    </div>
  );
}
