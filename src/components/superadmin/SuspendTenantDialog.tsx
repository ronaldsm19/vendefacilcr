"use client";

import { useEffect, useState } from "react";
import { SUSPENSION_REASONS, SUSPENSION_MESSAGE_MAX, type SuspensionReason } from "@/lib/suspension";

/** Confirmación para suspender un negocio, con el motivo y un mensaje opcional para el dueño. */
export default function SuspendTenantDialog({
  tenantName,
  saving,
  error,
  onCancel,
  onConfirm,
}: {
  tenantName: string;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (data: { suspendedReason: SuspensionReason; suspendedMessage: string }) => void;
}) {
  const [reason, setReason] = useState<SuspensionReason>("falta_pago");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog" aria-modal="true" aria-labelledby="suspend-title"
      onClick={() => { if (!saving) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "#13131b", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="suspend-title" className="text-lg font-semibold text-white">Suspender {tenantName}</h2>
          <p className="text-sm text-white/50 mt-1">
            El panel, la app y la tienda en línea dejan de funcionar en menos de un minuto, también para
            quien ya tenga la sesión abierta.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm text-white/60 mb-2">Motivo</legend>
          {SUSPENSION_REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2.5 text-sm text-white/80 cursor-pointer">
              <input
                type="radio" name="suspend-reason" value={r.value}
                checked={reason === r.value} onChange={() => setReason(r.value)}
                className="accent-red-500"
              />
              {r.label}
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="suspend-message" className="block text-sm text-white/60">Mensaje para el dueño (opcional)</label>
          <textarea
            id="suspend-message" rows={3} maxLength={SUSPENSION_MESSAGE_MAX}
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej.: Hacé el SINPE y mandame el comprobante para reactivarlo."
            className="saas-input resize-none"
          />
          <p className="text-xs text-white/30">
            Solo lo ve el dueño. El personal y los clientes ven un aviso neutro, sin el motivo.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button" onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button" disabled={saving}
            onClick={() => onConfirm({ suspendedReason: reason, suspendedMessage: message })}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 cursor-pointer disabled:opacity-50"
          >
            {saving ? "Suspendiendo..." : "Suspender"}
          </button>
        </div>
      </div>
    </div>
  );
}
