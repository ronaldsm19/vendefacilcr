"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Clock, CreditCard, ExternalLink, FileText, Gift, Hourglass, ImageIcon, Loader2,
  MessageCircle, Trash2, Upload, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ProofUploadDialog, { type UploadTarget } from "@/components/admin/mensualidad/ProofUploadDialog";
import { formatCRC, type PriceBreakdown } from "@/lib/billing";
import type { OwnerStatus, ProofStatus } from "@/lib/mensualidad";

/**
 * Mensualidad: lo que el negocio le paga a Ennea. El dueño ve cuánto le toca cada mes y por qué
 * (plan, descuento, fundador), sube el comprobante y sigue la revisión; abajo, el historial.
 */

interface Proof {
  id: string;
  url: string;
  isPdf: boolean;
  paidOn: string;
  method: string;
  reference: string;
  note: string;
  uploadedAt: string;
  status: ProofStatus;
  rejectReason: string;
  canDelete: boolean;
}

interface Month {
  id: string;
  period: string;
  plan: string;
  amount: number;
  listAmount: number;
  discountAmount: number;
  discountLabel: string;
  status: OwnerStatus;
  statusLabel: string;
  dueDate: string;
  paidAt: string | null;
  rejectReason: string;
  uploadBlocked: string | null;
  proofs: Proof[];
}

interface View {
  planLabel: string;
  price: PriceBreakdown;
  discountUntil: string | null;
  freeUntil: string | null;
  upcoming: { from: string; amount: number; label: string } | null;
  focusId: string | null;
  months: Month[];
  payment: { sinpeNumber: string; sinpeName: string; iban: string; ibanName: string; notes: string; whatsapp: string };
  today: string;
}

const STATUS_STYLE: Record<OwnerStatus, { className: string; icon: LucideIcon }> = {
  pendiente:  { className: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock },
  atrasada:   { className: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  revision:   { className: "bg-sky-50 text-sky-800 border-sky-200", icon: Hourglass },
  rechazado:  { className: "bg-orange-50 text-orange-800 border-orange-200", icon: AlertTriangle },
  verificado: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  sin_costo:  { className: "bg-slate-50 text-slate-700 border-slate-200", icon: Gift },
  anulada:    { className: "bg-gray-50 text-gray-600 border-gray-200", icon: Ban },
};

const PROOF_STATUS: Record<ProofStatus, { label: string; className: string }> = {
  submitted: { label: "En revisión", className: "text-sky-800" },
  approved:  { label: "Aprobado", className: "text-emerald-700" },
  rejected:  { label: "Rechazado", className: "text-orange-800" },
};

/** Meses en los que tiene sentido subir un comprobante. */
const canUpload = (m: Month) => !m.uploadBlocked && ["pendiente", "atrasada", "rechazado", "revision"].includes(m.status);

function StatusChip({ month }: { month: Month }) {
  const style = STATUS_STYLE[month.status];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border ${style.className}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {month.statusLabel}
    </span>
  );
}

export default function MensualidadPage() {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadFor, setUploadFor] = useState<UploadTarget | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mensualidad");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar la mensualidad");
      setView(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la mensualidad");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const removeProof = async (month: Month, proof: Proof) => {
    if (!confirm(`¿Quitar el comprobante de ${month.period}? Todavía no lo revisamos, así que podés subir otro.`)) return;
    setNotice("");
    const res = await fetch(`/api/admin/mensualidad/${month.id}/comprobantes/${proof.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "No se pudo quitar el comprobante");
    await load();
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full text-brand-dark/40">
        <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden /> Cargando mensualidad...
      </div>
    );
  }

  const focus = view?.months.find((m) => m.id === view.focusId) ?? null;
  const openUpload = (m: Month) => { setNotice(""); setUploadFor({ id: m.id, period: m.period, amount: m.amount }); };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Mensualidad</h1>
        <p className="text-brand-dark/50 text-sm mt-1">Lo que pagás por Ennea cada mes, tus comprobantes y el historial de pagos</p>
      </div>

      {error && <p role="alert" className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
      {notice && (
        <p role="status" className="flex items-center gap-2 text-emerald-800 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> {notice}
        </p>
      )}

      {view && (
        <>
          {focus ? (
            <FocusCard month={focus} onUpload={() => openUpload(focus)} onRemove={(p) => removeProof(focus, p)} />
          ) : (
            <div className="bg-white rounded-2xl card-shadow p-6 text-sm text-brand-dark/60">
              Todavía no hay mensualidades para mostrar.
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <PlanCard view={view} />
            <HowToPayCard payment={view.payment} />
          </div>

          <HistoryCard
            months={view.months}
            focusId={view.focusId}
            onUpload={openUpload}
            onRemove={removeProof}
          />
        </>
      )}

      {uploadFor && view && (
        <ProofUploadDialog
          target={uploadFor}
          today={view.today}
          onClose={() => setUploadFor(null)}
          onUploaded={() => {
            setUploadFor(null);
            setNotice("Listo, el comprobante quedó enviado.");
            void load();
          }}
        />
      )}
    </div>
  );
}

// ── Este mes ────────────────────────────────────────────────────────────────

function FocusCard({ month, onUpload, onRemove }: { month: Month; onUpload: () => void; onRemove: (p: Proof) => void }) {
  return (
    <section className="bg-white rounded-2xl card-shadow p-6 space-y-5" aria-labelledby="mes-actual">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark/45">
            {month.status === "verificado" || month.status === "sin_costo" ? "Al día" : "Mes por pagar"}
          </p>
          <h2 id="mes-actual" className="font-brand text-xl font-bold text-brand-dark first-letter:uppercase">{month.period}</h2>
        </div>
        <StatusChip month={month} />
      </div>

      <dl className="rounded-xl border border-brand-muted divide-y divide-brand-muted text-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-brand-dark/60">Plan {month.plan}</dt>
          <dd className={`tabular-nums whitespace-nowrap ${month.discountAmount > 0 ? "text-brand-dark/45 line-through" : "text-brand-dark"}`}>{formatCRC(month.listAmount)}</dd>
        </div>
        {month.discountAmount > 0 && (
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-emerald-700">{month.discountLabel || "Descuento"}</dt>
            <dd className="text-emerald-700 tabular-nums whitespace-nowrap">−{formatCRC(month.discountAmount)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="font-semibold text-brand-dark">{month.status === "verificado" ? "Pagado" : "Total a pagar"}</dt>
          <dd className="text-xl font-bold text-brand-dark tabular-nums whitespace-nowrap">{formatCRC(month.amount)}</dd>
        </div>
      </dl>

      <MonthMessage month={month} />

      {month.proofs.length > 0 && <ProofList month={month} onRemove={onRemove} />}

      {canUpload(month) && (
        <Button onClick={onUpload} className="w-full sm:w-auto">
          <Upload className="w-4 h-4" aria-hidden />
          {month.proofs.length ? "Subir otro comprobante" : "Subir comprobante"}
        </Button>
      )}
      {month.uploadBlocked && ["pendiente", "atrasada", "rechazado", "revision"].includes(month.status) && (
        <p className="text-sm text-brand-dark/60">{month.uploadBlocked}</p>
      )}
    </section>
  );
}

function MonthMessage({ month }: { month: Month }) {
  switch (month.status) {
    case "pendiente":
      return <p className="text-sm text-brand-dark/70">Vence el {month.dueDate}. Cuando pagues, subí el pantallazo del comprobante.</p>;
    case "atrasada":
      return <p className="text-sm text-red-700">Venció el {month.dueDate}. Cuando pagues, subí el pantallazo del comprobante.</p>;
    case "revision":
      return (
        <p className="flex gap-2 text-sm text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
          <Hourglass className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          Recibimos tu comprobante. Lo revisamos y te avisamos acá mismo cuando quede verificado.
        </p>
      );
    case "rechazado":
      return (
        <div className="flex gap-2 text-sm text-orange-900 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <p>
            <strong>Todavía no pudimos verificar tu pago.</strong> {month.rejectReason}
            <span className="block mt-1">Subí otro comprobante cuando lo tengas.</span>
          </p>
        </div>
      );
    case "verificado":
      return (
        <p className="flex gap-2 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          Pago verificado{month.paidAt ? ` (pagado el ${month.paidAt})` : ""}. ¡Gracias!
        </p>
      );
    case "sin_costo":
      return <p className="text-sm text-brand-dark/70">Este mes no tiene costo{month.discountLabel ? `: ${month.discountLabel}` : ""}.</p>;
    case "anulada":
      return <p className="text-sm text-brand-dark/70">Este mes se anuló y no se cobra.</p>;
  }
}

function ProofList({ month, onRemove }: { month: Month; onRemove: (p: Proof) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark/45 mb-2">
        {month.proofs.length === 1 ? "Tu comprobante" : "Tus comprobantes"}
      </p>
      <ul className="space-y-2">
        {month.proofs.map((p) => {
          const st = PROOF_STATUS[p.status];
          const Icon = p.isPdf ? FileText : ImageIcon;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand-muted px-3 py-2.5 text-sm">
              <Icon className="w-4 h-4 shrink-0 text-brand-dark/50" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-brand-dark">
                  Pago del {p.paidOn} · {p.method}
                  {p.reference && <span className="text-brand-dark/55"> · Ref. {p.reference}</span>}
                </p>
                <p className="text-xs text-brand-dark/50">
                  Subido el {p.uploadedAt} · <span className={`font-semibold ${st.className}`}>{st.label}</span>
                  {p.status === "rejected" && p.rejectReason && <span className="text-orange-800">: {p.rejectReason}</span>}
                </p>
                {p.note && <p className="text-xs text-brand-dark/60 mt-0.5">“{p.note}”</p>}
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-pink hover:underline">
                Ver <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
              {p.canDelete && (
                <button
                  type="button" onClick={() => onRemove(p)}
                  className="inline-flex items-center gap-1 text-sm text-brand-dark/55 hover:text-red-600 cursor-pointer"
                  aria-label={`Quitar el comprobante del ${p.paidOn}`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden /> Quitar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Plan y cómo pagar ───────────────────────────────────────────────────────

function PlanCard({ view }: { view: View }) {
  const { price } = view;
  return (
    <section className="bg-white rounded-2xl card-shadow p-6" aria-labelledby="tu-plan">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-4 h-4 text-brand-pink" aria-hidden />
        <h2 id="tu-plan" className="font-semibold text-brand-dark">Tu plan</h2>
      </div>
      <p className="text-sm text-brand-dark/60">Plan {view.planLabel}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-bold text-brand-dark tabular-nums">{price.free ? "Sin costo" : formatCRC(price.amount)}</span>
        {!price.free && <span className="text-sm text-brand-dark/50">al mes</span>}
        {price.discountAmount > 0 && !price.free && (
          <span className="text-sm text-brand-dark/40 line-through tabular-nums">{formatCRC(price.listAmount)}</span>
        )}
      </p>
      {price.discountLabel && (
        <p className="mt-2 text-sm text-emerald-700">
          {price.discountLabel}
          {view.discountUntil && <span className="text-brand-dark/50"> · hasta el {view.discountUntil}</span>}
          {view.freeUntil && <span className="text-brand-dark/50"> · hasta el {view.freeUntil}</span>}
        </p>
      )}
      {view.upcoming && (
        <p className="mt-3 rounded-xl bg-brand-muted/40 px-3 py-2 text-sm text-brand-dark/75">
          Desde <span className="first-letter:uppercase">{view.upcoming.from}</span>:{" "}
          <strong className="text-brand-dark tabular-nums">{view.upcoming.amount === 0 ? "sin costo" : formatCRC(view.upcoming.amount)}</strong>
          {view.upcoming.amount > 0 && " al mes"}
          {view.upcoming.label && view.upcoming.amount > 0 && <span className="text-emerald-700"> ({view.upcoming.label})</span>}
        </p>
      )}
    </section>
  );
}

function HowToPayCard({ payment }: { payment: View["payment"] }) {
  const hasData = Boolean(payment.sinpeNumber || payment.iban || payment.notes);
  const wa = `https://wa.me/${payment.whatsapp}?text=${encodeURIComponent("Hola, tengo una consulta sobre mi mensualidad de Ennea.")}`;
  return (
    <section className="bg-white rounded-2xl card-shadow p-6" aria-labelledby="como-pagar">
      <h2 id="como-pagar" className="font-semibold text-brand-dark mb-4">Cómo pagar</h2>
      {hasData ? (
        <div className="space-y-2 text-sm text-brand-dark/80">
          {payment.sinpeNumber && (
            <p>SINPE Móvil: <strong className="text-brand-dark tabular-nums">{payment.sinpeNumber}</strong>{payment.sinpeName && ` (${payment.sinpeName})`}</p>
          )}
          {payment.iban && (
            <p className="break-all">IBAN: <strong className="text-brand-dark">{payment.iban}</strong>{payment.ibanName && ` (${payment.ibanName})`}</p>
          )}
          {payment.notes && <p className="whitespace-pre-line">{payment.notes}</p>}
        </div>
      ) : (
        <p className="text-sm text-brand-dark/70">Escribinos por WhatsApp y te pasamos los datos para pagar.</p>
      )}
      <a
        href={wa} target="_blank" rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
      >
        <MessageCircle className="w-4 h-4" aria-hidden /> {hasData ? "¿Dudas? Escribinos" : "Pedir los datos por WhatsApp"}
      </a>
    </section>
  );
}

// ── Historial ───────────────────────────────────────────────────────────────

function HistoryCard({
  months, focusId, onUpload, onRemove,
}: {
  months: Month[];
  focusId: string | null;
  onUpload: (m: Month) => void;
  onRemove: (m: Month, p: Proof) => void;
}) {
  return (
    <section className="bg-white rounded-2xl card-shadow p-6" aria-labelledby="historial">
      <h2 id="historial" className="font-semibold text-brand-dark mb-1">Historial</h2>
      <p className="text-sm text-brand-dark/50 mb-4">Todos los meses, con la fecha en que se verificó cada pago.</p>
      {months.length === 0 ? (
        <p className="text-sm text-brand-dark/60">Todavía no hay meses en el historial.</p>
      ) : (
        <ul className="divide-y divide-brand-muted">
          {months.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-[8rem] flex-1">
                  <p className="font-medium text-brand-dark first-letter:uppercase">{m.period}</p>
                  <p className="text-xs text-brand-dark/50">
                    {m.status === "verificado" && m.paidAt ? `Pagado el ${m.paidAt}`
                      : m.status === "sin_costo" ? (m.discountLabel || "Sin costo")
                      : m.status === "anulada" ? "No se cobra"
                      : `Vence el ${m.dueDate}`}
                  </p>
                </div>
                <p className="text-sm font-semibold text-brand-dark tabular-nums">{formatCRC(m.amount)}</p>
                <StatusChip month={m} />
              </div>
              {(m.proofs.length > 0 || (canUpload(m) && m.id !== focusId)) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {m.proofs.map((p, i) => (
                    <span key={p.id} className="inline-flex items-center gap-2">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-pink font-medium hover:underline">
                        {m.proofs.length > 1 ? `Comprobante ${m.proofs.length - i}` : "Ver comprobante"}
                        <ExternalLink className="w-3 h-3" aria-hidden />
                      </a>
                      {p.canDelete && m.id !== focusId && (
                        <button type="button" onClick={() => onRemove(m, p)} className="text-brand-dark/50 hover:text-red-600 cursor-pointer text-xs">
                          Quitar
                        </button>
                      )}
                    </span>
                  ))}
                  {canUpload(m) && m.id !== focusId && (
                    <button type="button" onClick={() => onUpload(m)} className="inline-flex items-center gap-1 font-semibold text-brand-dark hover:text-brand-pink cursor-pointer">
                      <Upload className="w-3.5 h-3.5" aria-hidden /> Subir comprobante
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
