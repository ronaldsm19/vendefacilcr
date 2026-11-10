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
      className="sa-modal-backdrop"
      role="dialog" aria-modal="true" aria-labelledby="suspend-title"
      onClick={() => { if (!saving) onCancel(); }}
    >
      <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 id="suspend-title" className="sa-modal-title">Suspender {tenantName}</h2>
          <p className="sa-muted mt-1.5">
            El panel, la app y la tienda en línea dejan de funcionar en menos de un minuto, también para
            quien ya tenga la sesión abierta.
          </p>
        </div>

        <fieldset>
          <legend className="sa-label mb-2">Motivo</legend>
          <div className="flex flex-col gap-2">
            {SUSPENSION_REASONS.map((r) => (
              <label key={r.value} className="sa-check">
                <input
                  type="radio" name="suspend-reason" value={r.value}
                  checked={reason === r.value} onChange={() => setReason(r.value)}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="sa-field">
          <label htmlFor="suspend-message" className="sa-label">Mensaje para el dueño (opcional)</label>
          <textarea
            id="suspend-message" rows={3} maxLength={SUSPENSION_MESSAGE_MAX}
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej.: Hacé el SINPE y mandame el comprobante para reactivarlo."
            className="sa-input resize-none"
          />
          <p className="sa-help">
            Solo lo ve el dueño. El personal y los clientes ven un aviso neutro, sin el motivo.
          </p>
        </div>

        {error && <p className="sa-error" role="alert">{error}</p>}

        <div className="sa-modal-actions">
          <button type="button" onClick={onCancel} disabled={saving} className="sa-btn sa-btn-secondary">
            Cancelar
          </button>
          <button
            type="button" disabled={saving}
            onClick={() => onConfirm({ suspendedReason: reason, suspendedMessage: message })}
            className="sa-btn sa-btn-danger"
          >
            {saving ? "Suspendiendo..." : "Suspender"}
          </button>
        </div>
      </div>
    </div>
  );
}
