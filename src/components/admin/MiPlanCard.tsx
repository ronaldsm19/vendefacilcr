"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { formatCRC, type PriceBreakdown } from "@/lib/billing";

interface PlanView {
  planLabel: string;
  price: PriceBreakdown;
  discountUntil: string | null;
  freeUntil: string | null;
  nextDue: string;
  invoice: null | { period: string; amount: number; dueDate: string; status: "pending" | "late"; daysToDue: number; suspendDate: string | null };
  payment: null | { sinpeNumber: string; sinpeName: string; iban: string; ibanName: string; whatsapp: string; notes: string };
}

/** La mensualidad del negocio, como la ve el dueño: plan, descuento, lo que paga y el próximo cobro. */
export default function MiPlanCard() {
  const [view, setView] = useState<PlanView | null>(null);

  useEffect(() => {
    fetch("/api/admin/billing")
      .then((r) => (r.ok ? r.json() : null))
      .then(setView)
      .catch(() => setView(null));
  }, []);

  if (!view) return null;
  const { price, invoice, payment } = view;
  const wa = (payment?.whatsapp ?? "").replace(/\D/g, "");

  const status = invoice
    ? invoice.status === "late"
      ? { text: "Atrasado", className: "bg-red-50 text-red-700 border-red-200" }
      : { text: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" }
    : { text: price.free ? "Sin costo" : "Al día", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  return (
    <div className="bg-white rounded-2xl card-shadow p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-brand-pink" aria-hidden />
          <h2 className="font-semibold text-brand-dark">Mi plan</h2>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${status.className}`}>{status.text}</span>
      </div>

      <dl className="divide-y divide-brand-muted">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-sm text-brand-dark/55">Plan {view.planLabel}</dt>
          <dd className={`text-sm tabular-nums ${price.discountAmount > 0 ? "text-brand-dark/45 line-through" : "font-medium text-brand-dark"}`}>
            {formatCRC(price.listAmount)}
          </dd>
        </div>
        {price.discountAmount > 0 && (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-emerald-700">
              {price.discountLabel}
              {view.discountUntil && <span className="text-brand-dark/45"> · hasta el {view.discountUntil}</span>}
              {view.freeUntil && <span className="text-brand-dark/45"> · hasta el {view.freeUntil}</span>}
            </dt>
            <dd className="text-sm text-emerald-700 tabular-nums">−{formatCRC(price.discountAmount)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-sm font-semibold text-brand-dark">Pagás al mes</dt>
          <dd className="text-lg font-bold text-brand-dark tabular-nums">{price.free ? "₡0" : formatCRC(price.amount)}</dd>
        </div>
      </dl>

      {invoice ? (
        <p className={`mt-3 text-sm ${invoice.status === "late" ? "text-red-700" : "text-brand-dark/70"}`}>
          {invoice.status === "late"
            ? `Tu mensualidad de ${invoice.period} (${formatCRC(invoice.amount)}) venció el ${invoice.dueDate}.`
            : `Tu mensualidad de ${invoice.period} (${formatCRC(invoice.amount)}) vence el ${invoice.dueDate}.`}
          {invoice.suspendDate && ` Si no se registra el pago, el acceso se suspende el ${invoice.suspendDate}.`}
        </p>
      ) : (
        !price.free && <p className="mt-3 text-sm text-brand-dark/55">Próximo cobro: {view.nextDue}.</p>
      )}

      {!price.free && payment && (
        <div className="mt-4 rounded-xl bg-brand-muted/40 px-4 py-3 text-sm text-brand-dark/80 space-y-1">
          <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wide">Cómo pagar</p>
          {payment.sinpeNumber && <p>SINPE Móvil: <strong>{payment.sinpeNumber}</strong>{payment.sinpeName && ` (${payment.sinpeName})`}</p>}
          {payment.iban && <p className="break-all">IBAN: <strong>{payment.iban}</strong>{payment.ibanName && ` (${payment.ibanName})`}</p>}
          {payment.notes && <p className="whitespace-pre-line">{payment.notes}</p>}
          {wa && (
            <p>
              Mandá el comprobante por{" "}
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-pink underline">WhatsApp</a>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
