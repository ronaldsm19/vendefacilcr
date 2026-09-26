"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Ban, Download, ExternalLink, Loader2, MessageCircle, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminSession } from "@/components/admin/SessionContext";
import { formatHoursMinutes } from "@/lib/workPeriod";
import {
  PAY_METHOD_LABELS,
  money,
  payRateLabel,
  whatsappNumber,
  type PaymentView,
  type PayrollRow,
  type StaffPayrollDetailData,
} from "@/lib/payroll";
import { buildPayrollReceipt, receiptFilename } from "@/lib/payrollReceipt";

/**
 * Detalle de una persona: lo que se le debe, cada pago que se le hizo y su comprobante.
 *
 * El comprobante se genera en el navegador y se sube a Supabase, porque **un enlace de
 * WhatsApp solo puede llevar texto**: no hay forma de adjuntarle un archivo. Por eso el
 * mensaje lleva el resumen escrito y el enlace al PDF, y aparte queda el botón de descarga
 * para mandarlo como archivo a mano.
 */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function StaffPayrollDetail({
  row,
  onClose,
  onChanged,
}: {
  row: PayrollRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const session = useAdminSession();
  const [data, setData] = useState<StaffPayrollDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<PaymentView | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/payroll/staff/${row.staffUserId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo cargar");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [row.staffUserId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Trae el pago con sus turnos: el comprobante los lista. */
  const fetchFull = async (id: string): Promise<PaymentView> => {
    const res = await fetch(`/api/admin/payroll/payments/${id}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "No se pudo cargar el pago");
    return body.payment;
  };

  const download = async (p: PaymentView) => {
    setBusyId(p._id);
    setError("");
    try {
      const full = await fetchFull(p._id);
      const doc = await buildPayrollReceipt(full, { name: session.tenantName, slug: session.tenantSlug });
      doc.save(receiptFilename(full));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el comprobante");
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Sube el comprobante si todavía no está y abre WhatsApp con el resumen y el enlace.
   * Se guarda la URL en el pago para no volver a subirlo en cada envío.
   */
  const sendWhatsapp = async (p: PaymentView) => {
    const number = whatsappNumber(data?.staff.phone ?? row.phone);
    if (!number) {
      setError("Esa persona no tiene teléfono. Agregáselo en la tarifa.");
      return;
    }
    setBusyId(p._id);
    setError("");
    try {
      const full = await fetchFull(p._id);
      let url = full.receiptPdf;

      if (!url) {
        const doc = await buildPayrollReceipt(full, { name: session.tenantName, slug: session.tenantSlug });
        const blob = doc.output("blob") as Blob;
        const form = new FormData();
        form.append("file", new File([blob], receiptFilename(full), { type: "application/pdf" }));
        const up = await fetch("/api/admin/upload?folder=planilla", { method: "POST", body: form });
        const upBody = await up.json();
        if (!up.ok) throw new Error(upBody.error ?? "No se pudo subir el comprobante");
        url = upBody.url;
        await fetch(`/api/admin/payroll/payments/${p._id}/receipt`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      }

      const text =
        `Hola ${full.staffName}, te paso el detalle de tu pago.\n\n` +
        `Período: ${fmtDate(full.periodFrom)} al ${fmtDate(full.periodTo)}\n` +
        `Horas: ${formatHoursMinutes(full.basis.minutes)}\n` +
        full.lines.map((l) => `${l.label}: ${money(l.amount)}`).join("\n") +
        `\n\nTotal: ${money(full.total)}\n` +
        `Forma de pago: ${PAY_METHOD_LABELS[full.method]}\n\n` +
        `Comprobante: ${url}`;

      window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setBusyId(null);
    }
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    setBusyId(voidTarget._id);
    setError("");
    try {
      const res = await fetch(`/api/admin/payroll/payments/${voidTarget._id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo anular");
      setVoidTarget(null);
      setVoidReason("");
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo anular");
    } finally {
      setBusyId(null);
    }
  };

  const unpaidMinutes = (data?.unpaidShifts ?? []).reduce((s, x) => s + x.minutes, 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle>{row.name}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-brand-dark/40">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-brand-muted/30 rounded-xl p-3">
                  <p className="text-xs text-brand-dark/40">Horas sin pagar</p>
                  <p className="font-bold text-brand-dark">{formatHoursMinutes(unpaidMinutes)}</p>
                </div>
                <div className="bg-brand-muted/30 rounded-xl p-3">
                  <p className="text-xs text-brand-dark/40">Tarifa</p>
                  <p className="font-bold text-brand-dark">{payRateLabel(data?.staff.pay ?? row.pay)}</p>
                </div>
              </div>

              {/* Turnos pendientes */}
              <div>
                <p className="text-sm font-medium text-brand-dark mb-2">Turnos sin pagar</p>
                {(data?.unpaidShifts ?? []).length === 0 ? (
                  <p className="text-sm text-brand-dark/40">Todo al día.</p>
                ) : (
                  <ul className="max-h-40 overflow-y-auto border border-brand-muted rounded-xl divide-y divide-brand-muted/60">
                    {data!.unpaidShifts.map((s) => (
                      <li key={s._id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-brand-dark/70">{fmtDate(s.startedAt)}</span>
                        <span className="font-semibold text-brand-dark tabular-nums">
                          {formatHoursMinutes(s.minutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Historial */}
              <div>
                <p className="text-sm font-medium text-brand-dark mb-2">Pagos hechos</p>
                {(data?.payments ?? []).length === 0 ? (
                  <p className="text-sm text-brand-dark/40">Todavía no se le ha pagado nada.</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {data!.payments.map((p) => (
                      <li
                        key={p._id}
                        className={`rounded-xl border p-3 space-y-2 ${
                          p.voidedAt ? "border-red-200 bg-red-50/50" : "border-brand-muted"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-brand-dark">
                              {money(p.total)}
                              {p.voidedAt && <span className="ml-2 text-xs font-bold text-red-500">ANULADO</span>}
                            </p>
                            <p className="text-xs text-brand-dark/50">
                              {fmtDate(p.paidAt)} · {PAY_METHOD_LABELS[p.method]}
                              {p.reference ? ` · ${p.reference}` : ""}
                            </p>
                            <p className="text-xs text-brand-dark/40">
                              {formatHoursMinutes(p.basis.minutes)} · {p.createdByName}
                            </p>
                            {p.voidedAt && (
                              <p className="text-xs text-red-500 mt-1">
                                {p.voidReason} — {p.voidedByName}
                              </p>
                            )}
                          </div>
                          {p.proofImage && (
                            <a
                              href={p.proofImage}
                              target="_blank"
                              rel="noreferrer"
                              className="relative w-14 h-14 rounded-lg overflow-hidden border border-brand-muted shrink-0"
                              title="Ver el comprobante"
                            >
                              <Image src={p.proofImage} alt="Comprobante" fill className="object-cover" sizes="56px" />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="secondary" disabled={busyId === p._id} onClick={() => download(p)}>
                            {busyId === p._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            <span className="ml-1">Comprobante</span>
                          </Button>
                          <Button size="sm" variant="secondary" disabled={busyId === p._id} onClick={() => sendWhatsapp(p)}>
                            <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                          </Button>
                          {p.receiptPdf && (
                            <a
                              href={p.receiptPdf}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-brand-dark/50 hover:text-brand-dark flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Enlace
                            </a>
                          )}
                          {!p.voidedAt && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busyId === p._id}
                              onClick={() => { setVoidTarget(p); setVoidReason(""); }}
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" /> Anular
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

              {voidTarget && (
                <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-red-700 flex items-start gap-2">
                    <Receipt className="w-4 h-4 mt-0.5 shrink-0" />
                    Vas a anular el pago de {money(voidTarget.total)}. Sus horas vuelven a quedar pendientes.
                  </p>
                  <input
                    type="text"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="¿Por qué se anula?"
                    className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-red-400"
                  />
                  <div className="flex gap-3">
                    <Button variant="cancel" className="flex-1" onClick={() => setVoidTarget(null)}>Cancelar</Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={voidReason.trim().length < 3 || busyId === voidTarget._id}
                      onClick={confirmVoid}
                    >
                      Sí, anular
                    </Button>
                  </div>
                </div>
              )}

              <Button variant="cancel" className="w-full" onClick={onClose}>Cerrar</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
