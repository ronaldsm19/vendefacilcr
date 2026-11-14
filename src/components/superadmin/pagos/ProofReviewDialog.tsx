"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, FileText, X } from "lucide-react";
import { formatCRC } from "@/lib/billing";
import { PROOF_LIMITS, REJECT_REASONS, type OwnerStatus, type ProofStatus } from "@/lib/mensualidad";
import { PaymentStateChip, REVIEW_CHANGED_EVENT } from "@/components/superadmin/pagos/paymentStatus";

interface Proof {
  id: string;
  url: string;
  isPdf: boolean;
  paidOn: string;
  method: string;
  reference: string;
  note: string;
  uploadedAt: string;
  uploadedBy: string;
  status: ProofStatus;
  rejectReason: string;
}

interface Invoice {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  period: string;
  plan: string;
  amount: number;
  listAmount: number;
  discountAmount: number;
  discountLabel: string;
  status: string;
  ownerStatus: OwnerStatus;
  dueDate: string;
  paidAt: string | null;
  method: string;
  reference: string;
  review: { status: string; reason: string; reviewedAt: string | null; reviewedBy: string };
  canReview: boolean;
  proofs: Proof[];
}

const PROOF_LABEL: Record<ProofStatus, string> = { submitted: "Por revisar", approved: "Aprobado", rejected: "Rechazado" };

/**
 * Revisar los comprobantes de un mes: la imagen al lado de lo que tiene que pagar el negocio, y los
 * botones para dar el pago por verificado o rechazarlo con un motivo (el negocio lo ve en su panel).
 */
export default function ProofReviewDialog({
  paymentId, onClose, onChanged,
}: {
  paymentId: string;
  onClose: () => void;
  /** Se aprobó o rechazó: la pantalla de atrás recarga. */
  onChanged: (message: string) => void;
}) {
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/superadmin/pagos/${paymentId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "No se pudo cargar la factura"); return; }
    setInv(data);
    setSelected((cur) => cur ?? data.proofs?.[0]?.id ?? null);
  }, [paymentId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const act = async (action: "approve" | "reject") => {
    if (!inv) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/superadmin/pagos/${inv.id}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action } : { action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "No se pudo guardar la revisión"); return; }
      window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT));
      onChanged(action === "approve"
        ? `Pago de ${inv.tenantName} (${inv.period}) verificado.${data.reactivated ? " El negocio estaba suspendido por falta de pago y se reactivó." : ""}`
        : `Comprobante de ${inv.tenantName} (${inv.period}) rechazado. El negocio ya ve el motivo.`);
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  const proof = inv?.proofs.find((p) => p.id === selected) ?? null;

  return (
    <div className="sa-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={() => { if (!saving) onClose(); }}>
      <div className="sa-modal sa-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="review-title" className="sa-modal-title">{inv ? inv.tenantName : "Comprobante"}</h2>
            {inv && (
              <p className="sa-muted mt-1 flex flex-wrap items-center gap-2">
                <span className="first-letter:uppercase">Mensualidad de {inv.period}</span>
                <PaymentStateChip status={inv.ownerStatus} />
              </p>
            )}
          </div>
          <button type="button" className="sa-icon-btn" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {!inv && !error && <div className="sa-empty">Cargando...</div>}
        {error && <p className="sa-alert sa-alert-danger" role="alert">{error}</p>}

        {inv && (
          <>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              {/* El comprobante */}
              <div className="flex min-w-0 flex-col gap-3">
                {inv.proofs.length > 1 && (
                  <div className="sa-seg" role="group" aria-label="Comprobantes de este mes">
                    {inv.proofs.map((p, i) => (
                      <button key={p.id} type="button" aria-pressed={p.id === selected} onClick={() => setSelected(p.id)}>
                        {inv.proofs.length - i}. {PROOF_LABEL[p.status]}
                      </button>
                    ))}
                  </div>
                )}
                {proof ? (
                  proof.isPdf ? (
                    <a href={proof.url} target="_blank" rel="noopener noreferrer" className="sa-inset flex items-center justify-center gap-2 py-12 sa-link">
                      <FileText className="w-5 h-5" aria-hidden /> Abrir el PDF
                    </a>
                  ) : (
                    <a href={proof.url} target="_blank" rel="noopener noreferrer" className="sa-inset block overflow-hidden" title="Abrir en grande">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proof.url} alt={`Comprobante de ${inv.tenantName}`} className="mx-auto max-h-[55vh] w-auto object-contain" />
                    </a>
                  )
                ) : (
                  <div className="sa-inset sa-empty">Este mes no tiene comprobantes. Se puede registrar el pago a mano desde la lista.</div>
                )}
                {proof && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                    <dt className="sa-muted">Fecha del pago</dt><dd className="sa-num">{proof.paidOn}</dd>
                    <dt className="sa-muted">Método</dt><dd>{proof.method}</dd>
                    {proof.reference && (<><dt className="sa-muted">Referencia</dt><dd className="sa-mono break-all">{proof.reference}</dd></>)}
                    {proof.note && (<><dt className="sa-muted">Nota</dt><dd>{proof.note}</dd></>)}
                    <dt className="sa-muted">Lo subió</dt><dd className="break-all">{proof.uploadedBy || "—"} · <span className="sa-num">{proof.uploadedAt}</span></dd>
                    <dt className="sa-muted">Estado</dt>
                    <dd>{PROOF_LABEL[proof.status]}{proof.status === "rejected" && proof.rejectReason ? `: ${proof.rejectReason}` : ""}</dd>
                  </dl>
                )}
                {proof && (
                  <a href={proof.url} target="_blank" rel="noopener noreferrer" className="sa-link inline-flex items-center gap-1 text-[13px]">
                    Abrir en otra pestaña <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                  </a>
                )}
              </div>

              {/* Lo que tiene que pagar */}
              <div className="flex flex-col gap-3">
                <div className="sa-inset p-4">
                  <p className="sa-eyebrow mb-2">Tiene que pagar</p>
                  <dl className="flex flex-col gap-1.5 text-[13px]">
                    <div className="flex justify-between gap-3">
                      <dt className="sa-muted">Plan {inv.plan}</dt>
                      <dd className={`sa-num whitespace-nowrap ${inv.discountAmount > 0 ? "line-through sa-muted" : ""}`}>{formatCRC(inv.listAmount)}</dd>
                    </div>
                    {inv.discountAmount > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="sa-ok-text">{inv.discountLabel || "Descuento"}</dt>
                        <dd className="sa-num sa-ok-text whitespace-nowrap">−{formatCRC(inv.discountAmount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 border-t border-[var(--sa-line)] pt-1.5">
                      <dt className="sa-strong">Total</dt>
                      <dd className="sa-num sa-strong text-base whitespace-nowrap">{formatCRC(inv.amount)}</dd>
                    </div>
                  </dl>
                  <p className="sa-help mt-2">Vence el {inv.dueDate}</p>
                </div>
                {inv.status === "paid" && (
                  <p className="sa-alert sa-alert-ok">
                    <Check aria-hidden />
                    <span>Pagado el {inv.paidAt ?? "—"}{inv.method ? ` · ${inv.method}` : ""}{inv.review.reviewedBy ? ` · verificado por ${inv.review.reviewedBy}` : ""}</span>
                  </p>
                )}
                {inv.ownerStatus === "rechazado" && (
                  <p className="sa-alert sa-alert-warn"><span>Rechazado{inv.review.reviewedAt ? ` el ${inv.review.reviewedAt}` : ""}: {inv.review.reason}. Esperando otro comprobante.</span></p>
                )}
                <Link href={`/superadmin/tenants/${inv.tenantId}`} className="sa-link text-[13px]">Ver la ficha del negocio</Link>
              </div>
            </div>

            {inv.canReview && (
              rejecting ? (
                <div className="flex flex-col gap-3 border-t border-[var(--sa-line)] pt-4">
                  <p className="sa-label">¿Por qué no se puede dar por bueno? El negocio lo va a leer.</p>
                  <div className="flex flex-wrap gap-2">
                    {REJECT_REASONS.map((r) => (
                      <button key={r} type="button" className="sa-btn sa-btn-sm sa-btn-secondary" aria-pressed={reason === r} onClick={() => setReason(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="sa-input min-h-[72px] py-2" value={reason} maxLength={PROOF_LIMITS.reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Por ejemplo: llegaron ₡10 000, faltan ₡2 500"
                    aria-label="Motivo del rechazo"
                  />
                  <div className="sa-modal-actions">
                    <button type="button" className="sa-btn sa-btn-ghost" disabled={saving} onClick={() => setRejecting(false)}>Volver</button>
                    <button type="button" className="sa-btn sa-btn-danger" disabled={saving || reason.trim().length < 3} onClick={() => act("reject")}>
                      {saving ? "Guardando..." : "Rechazar comprobante"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sa-modal-actions border-t border-[var(--sa-line)] pt-4">
                  <button type="button" className="sa-btn sa-btn-ghost-danger" disabled={saving} onClick={() => { setReason(""); setRejecting(true); }}>
                    Rechazar
                  </button>
                  <button type="button" className="sa-btn sa-btn-primary" disabled={saving} onClick={() => act("approve")}>
                    <Check className="w-4 h-4" aria-hidden />
                    {saving ? "Guardando..." : "Pago verificado"}
                  </button>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
