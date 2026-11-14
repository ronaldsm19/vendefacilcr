"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InvoiceCustomerPicker from "@/components/admin/InvoiceCustomerPicker";
import type { CustomerView } from "@/lib/customerId";
import type { SaleInvoiceSummary } from "@/lib/saleReceipt";

/**
 * Factura de una venta ya hecha, desde Pedidos y ventas: mandarla cuando el cliente la pide después
 * de pagar (lo más común), reenviarla si falló el correo o si la venta se editó, o pasarla a otro
 * cliente.
 */

export interface SaleInvoiceTarget {
  id: string;
  label: string;
  invoice: SaleInvoiceSummary | null;
}

interface Props {
  sale: SaleInvoiceTarget | null;
  onClose: () => void;
  onUpdated: (saleId: string, invoice: SaleInvoiceSummary | null, customerName: string) => void;
}

function sentLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-CR", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" })}`;
}

export function invoiceBadge(inv: SaleInvoiceSummary): { text: string; className: string } {
  if (inv.status === "fallido") return { text: "Factura sin enviar", className: "bg-red-50 text-red-600" };
  if (inv.outdated) return { text: "Factura por reenviar", className: "bg-amber-50 text-amber-700" };
  if (inv.status === "enviado") return { text: "Factura enviada", className: "bg-emerald-50 text-emerald-600" };
  return { text: "Factura enviándose", className: "bg-brand-muted text-brand-dark/60" };
}

export default function SaleInvoiceDialog({ sale, onClose, onUpdated }: Props) {
  const [changing, setChanging] = useState(false);
  const [customer, setCustomer] = useState<CustomerView | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<SaleInvoiceSummary | null>(null);

  useEffect(() => {
    if (!sale) return;
    setCurrent(sale.invoice);
    setChanging(!sale.invoice);
    setCustomer(null);
    setError("");
  }, [sale]);

  async function send(body: { customerId: string } | { resend: true }) {
    if (!sale) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/sales/${sale.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      // Aunque el correo falle, la venta ya quedó a nombre del cliente: se refleja igual.
      if (data.invoice !== undefined) {
        setCurrent(data.invoice);
        onUpdated(sale.id, data.invoice, data.customerName ?? "");
      }
      if (!res.ok) { setError(data.error ?? "No se pudo mandar el comprobante"); return; }
      setChanging(false);
      setCustomer(null);
    } catch {
      setError("No se pudo mandar el comprobante. Revisá la conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={!!sale} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-2">
          <DialogTitle>Factura de la venta {sale?.label}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          {current && (
            <div className="rounded-xl border border-brand-muted px-3 py-3 space-y-1.5">
              <p className="text-sm font-semibold text-brand-dark">{current.customerName}</p>
              <p className="text-xs text-brand-dark/50 break-all">{current.email}</p>
              {current.status === "fallido" ? (
                <p className="flex items-start gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>El correo no salió{current.error ? `: ${current.error}` : ""}.</span>
                </p>
              ) : current.status === "enviado" ? (
                <p className="flex items-start gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
                  {/* Sin punto final: la hora ya termina en "a. m." / "p. m.". */}
                  <span>Enviado el {sentLabel(current.sentAt)}</span>
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-xs text-brand-dark/50">
                  <Clock className="w-3.5 h-3.5 mt-px shrink-0" /> Enviándose…
                </p>
              )}
              {current.outdated && (
                <p className="flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>La venta se editó después del envío: el comprobante que tiene ya no coincide.</span>
                </p>
              )}
            </div>
          )}

          {changing ? (
            <div className="space-y-3">
              <InvoiceCustomerPicker value={customer} onChange={setCustomer} disabled={sending} />
              <p className="text-xs text-brand-dark/40">
                Se le manda por correo un comprobante de venta en PDF. No es factura electrónica de Hacienda.
              </p>
            </div>
          ) : null}

          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cerrar</Button>
            {changing ? (
              <Button className="flex-1" disabled={!customer || sending} onClick={() => customer && send({ customerId: customer._id })}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Enviar</>}
              </Button>
            ) : (
              <Button className="flex-1" disabled={sending} onClick={() => send({ resend: true })}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Reenviar</>}
              </Button>
            )}
          </div>

          {current && !changing && (
            <button
              type="button" onClick={() => setChanging(true)}
              className="w-full text-center text-xs font-medium text-brand-dark/50 hover:text-brand-pink cursor-pointer"
            >
              Mandarla a otro cliente
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
