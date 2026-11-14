"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { invoiceBadge } from "@/components/admin/SaleInvoiceDialog";
import type { CustomerView } from "@/lib/customerId";
import type { SaleInvoiceSummary } from "@/lib/saleReceipt";

/** Últimos comprobantes de un cliente, con reenvío. Lo abre la página Clientes. */

interface InvoiceRow {
  saleId: string;
  ticketNumber: number;
  date: string;
  total: number;
  invoice: SaleInvoiceSummary | null;
}

interface Props {
  customer: CustomerView | null;
  onClose: () => void;
}

export default function CustomerInvoicesDialog({ customer, onClose }: Props) {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    let alive = true;
    setRows([]);
    setError("");
    setLoading(true);
    fetch(`/api/admin/invoice-customers/${customer._id}/invoices`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok) setError(d.error ?? "No se pudieron cargar los comprobantes");
        else setRows(d.invoices ?? []);
      })
      .catch(() => alive && setError("No se pudieron cargar los comprobantes. Revisá la conexión."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [customer]);

  async function resend(saleId: string) {
    setSending(saleId);
    setError("");
    try {
      const res = await fetch(`/api/admin/sales/${saleId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resend: true }),
      });
      const data = await res.json();
      if (data.invoice !== undefined) {
        setRows((prev) => prev.map((r) => (r.saleId === saleId ? { ...r, invoice: data.invoice } : r)));
      }
      if (!res.ok) setError(data.error ?? "No se pudo reenviar");
    } catch {
      setError("No se pudo reenviar. Revisá la conexión.");
    } finally {
      setSending(null);
    }
  }

  return (
    <Dialog open={!!customer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-2">
          <DialogTitle>Comprobantes de {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-brand-dark/40">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
            </p>
          ) : rows.length === 0 && !error ? (
            <p className="text-sm text-brand-dark/40">Todavía no se le ha mandado ningún comprobante.</p>
          ) : (
            <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
              {rows.map((r) => {
                const badge = r.invoice ? invoiceBadge(r.invoice) : null;
                return (
                  <li key={r.saleId} className="flex items-center gap-3 rounded-xl border border-brand-muted px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark">
                        N.º {r.ticketNumber} · ₡{r.total.toLocaleString("es-CR")}
                      </p>
                      <p className="text-xs text-brand-dark/40">
                        {new Date(r.date).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      {badge && (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.className}`}>
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <Button size="sm" variant="secondary" disabled={sending !== null} onClick={() => resend(r.saleId)}>
                      {sending === r.saleId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" /> Reenviar</>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <Button variant="cancel" className="w-full" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
