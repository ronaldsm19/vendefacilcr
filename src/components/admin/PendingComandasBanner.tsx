"use client";

import { AlertTriangle } from "lucide-react";
import { usePendingComandas } from "@/components/admin/PendingComandasContext";

function humanMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "hace 0 min" se lee raro en el minuto cero, que es justo cuando la mesera acaba de comandar. */
function sinceLabel(minutes: number): string {
  return minutes < 1 ? "la más reciente es de hace un momento" : `la más vieja hace ${humanMinutes(minutes)}`;
}

/**
 * Aviso de comandas sin cobrar. Aparece solo si hay alguna, y lo que dice depende de quién mira:
 * la mesera ve las suyas, el admin y la caja ven las de todos y de quién es cada una.
 *
 * Parpadea a propósito: es lo que pidió el negocio para que una mesa no se vaya sin pagar porque
 * nadie miró la pantalla. El fondo es lo que late; el texto queda quieto para poder leerlo.
 */
export default function PendingComandasBanner({
  onAction,
  actionLabel = "Ver mesas",
  className = "",
}: {
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}) {
  const { pending } = usePendingComandas();
  if (!pending || pending.total === 0) return null;

  const { total, tables, scope, byWaiter, oldestMinutes, fromPreviousDays } = pending;
  const plural = total === 1 ? "comanda pendiente" : "comandas pendientes";
  const mesas = tables === 1 ? "1 mesa" : `${tables} mesas`;

  return (
    <div
      role="status"
      className={`relative overflow-hidden rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 ${className}`}
    >
      <span aria-hidden className="absolute inset-0 bg-amber-200/60 animate-pulse" />
      <div className="relative flex items-center gap-3">
        <span className="relative flex w-5 h-5 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60" />
          <AlertTriangle className="relative w-4 h-4 text-amber-700" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">
            {scope === "mine" ? `Tenés ${total} ${plural} de cobrar` : `${total} ${plural} de cobrar`}
            <span className="font-normal"> · {mesas}</span>
            {oldestMinutes !== null && <span className="font-normal"> · {sinceLabel(oldestMinutes)}</span>}
          </p>
          {fromPreviousDays > 0 && (
            <p className="text-[11px] font-semibold text-red-700">
              {fromPreviousDays === 1
                ? "1 viene de un día anterior"
                : `${fromPreviousDays} vienen de días anteriores`}
            </p>
          )}
          {scope === "all" && byWaiter.length > 0 && (
            <p className="text-[11px] text-amber-800 truncate">
              {byWaiter.map((w) => `${w.waiterName}: ${w.count}`).join(" · ")}
            </p>
          )}
        </div>

        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
