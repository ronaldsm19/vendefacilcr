import type { ReactNode } from "react";
import { Lock } from "lucide-react";

/**
 * Pantalla de negocio suspendido. La usan la página de ingreso (con el texto neutro) y el panel
 * cuando se corta una sesión abierta (con el motivo, si quien está adentro es el dueño).
 * Sin colores del negocio a propósito: cuando se muestra, puede que el tema todavía no haya cargado.
 */
export default function SuspendedScreen({
  tenantName,
  title,
  message,
  note,
  action,
}: {
  tenantName: string;
  title: string;
  message: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "#F5F3EF" }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 border border-black/5 shadow-sm text-center space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{tenantName}</p>
        <div className="mx-auto w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
          <Lock className="w-5 h-5" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        <p className="text-sm leading-relaxed text-neutral-600">{message}</p>
        {note && (
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-left">
            <p className="text-xs font-medium text-neutral-400 mb-1">Mensaje de VendeFácil</p>
            <p className="text-sm text-neutral-700 whitespace-pre-line">{note}</p>
          </div>
        )}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
