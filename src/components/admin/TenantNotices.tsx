"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Megaphone, Upload, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "@/components/admin/SessionContext";
import { usePolling } from "@/hooks/usePolling";
import { formatCRC, type PriceBreakdown } from "@/lib/billing";
import { LOGIN_NOTICES_FLAG, type NoticeKind } from "@/lib/notices";

/** Resultado de la revisión de un comprobante que el dueño todavía no vio. */
interface Review { id: string; period: string; amount: number; status: "approved" | "rejected"; reason: string }
interface PaymentInfo { sinpeNumber: string; sinpeName: string; iban: string; ibanName: string; whatsapp: string; notes: string }
interface Plan { planLabel: string; price: PriceBreakdown; payment: PaymentInfo | null }
interface Billing extends Plan {
  period: string;
  amount: number;
  dueDate: string;
  status: "pending" | "late";
  daysToDue: number;
  suspendDate: string | null;
}
interface Notice { id: string; kind: NoticeKind; title: string; body: string; showEveryLogin: boolean; seen: boolean }
interface Data { billing: Billing | null; plan: Plan | null; review?: Review | null; notices: Notice[] }

type Item = { type: "billing"; billing: Billing } | { type: "notice"; notice: Notice; plan: Plan | null };

const POLL_MS = 10 * 60 * 1000;

const today = () => new Date().toLocaleDateString("en-CA");

/** Si la sesión se acaba de iniciar: el login deja una marca y acá se consume. */
function takeLoginFlag(): boolean {
  try {
    if (sessionStorage.getItem(LOGIN_NOTICES_FLAG) !== "1") return false;
    sessionStorage.removeItem(LOGIN_NOTICES_FLAG);
    return true;
  } catch {
    return false;
  }
}

function dueText(b: Billing): string {
  if (b.status === "late") return "está vencida";
  if (b.daysToDue <= 0) return "vence hoy";
  if (b.daysToDue === 1) return "vence mañana";
  return `vence en ${b.daysToDue} días`;
}

/**
 * Avisos dentro del panel del negocio.
 * - Mensualidad por vencer o vencida (solo el dueño): una franja fija arriba y, además, una ventana
 *   en cada inicio de sesión. A quien nunca cierra sesión le sale una vez al día.
 * - Avisos que mandó Ennea: una ventana la primera vez (o en cada inicio de sesión, si el aviso
 *   lo pide). Al cerrarla queda registrado quién lo vio.
 */
export default function TenantNotices() {
  const session = useAdminSession();
  const [data, setData] = useState<Data | null>(null);
  const [queue, setQueue] = useState<Item[]>([]);
  /** Lo que ya se puso en cola desde que se cargó el panel, para no repetirlo en cada consulta. */
  const queued = useRef(new Set<string>());
  const firstLoad = useRef(true);
  const dayKey = `vf_notices_day:${session.tenantSlug}:${session.userId}`;

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/notices");
    if (!res.ok) return;
    const d = await res.json() as Data;
    setData(d);

    const justLoggedIn = firstLoad.current && takeLoginFlag();
    firstLoad.current = false;
    const next: Item[] = [];

    if (d.billing) {
      let shownToday = false;
      try { shownToday = localStorage.getItem(dayKey) === today(); } catch {}
      const key = `billing:${today()}`;
      if (!queued.current.has(key) && (justLoggedIn || !shownToday)) {
        queued.current.add(key);
        next.push({ type: "billing", billing: d.billing });
        try { localStorage.setItem(dayKey, today()); } catch {}
      }
    }
    for (const notice of d.notices) {
      if (queued.current.has(notice.id)) continue;
      if (!notice.seen || (notice.showEveryLogin && justLoggedIn)) {
        queued.current.add(notice.id);
        next.push({ type: "notice", notice, plan: d.plan });
      }
    }
    if (next.length) setQueue((q) => [...q, ...next]);
  }, [dayKey]);

  usePolling(load, POLL_MS, true);

  const current = queue[0];
  const close = useCallback(() => {
    if (current?.type === "notice") {
      void fetch(`/api/admin/notices/${current.notice.id}/seen`, { method: "POST" }).catch(() => {});
    }
    setQueue((q) => q.slice(1));
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, close]);

  const billing = data?.billing ?? null;
  const mensualidadHref = `/${session.tenantSlug}/admin/mensualidad`;
  const [closedReview, setClosedReview] = useState<string | null>(null);
  const review = data?.review && data.review.id !== closedReview ? data.review : null;
  const closeReview = () => {
    if (!review) return;
    setClosedReview(review.id);
    void fetch(`/api/admin/mensualidad/${review.id}/visto`, { method: "POST" }).catch(() => {});
  };

  return (
    <>
      {review && (
        <div
          role="status"
          className={`shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm border-b ${
            review.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          {review.status === "approved"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
            : <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />}
          <p className="min-w-0 flex-1">
            {review.status === "approved" ? (
              <><strong>Verificamos tu pago de {review.period} ({formatCRC(review.amount)}).</strong> ¡Gracias!</>
            ) : (
              <><strong>Revisá el comprobante de {review.period}:</strong> {review.reason}</>
            )}
          </p>
          <Link href={mensualidadHref} onClick={closeReview} className="shrink-0 font-semibold underline underline-offset-2">
            {review.status === "approved" ? "Ver mensualidad" : "Subir otro"}
          </Link>
          <button type="button" onClick={closeReview} aria-label="Cerrar aviso" className="shrink-0 p-1 -m-1 rounded cursor-pointer hover:bg-black/5">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      {billing && (
        <div
          role="status"
          className={`shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm border-b ${
            billing.status === "late" ? "bg-red-50 border-red-200 text-red-900" : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <Wallet className="w-4 h-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            <strong>Tu mensualidad de {billing.period} ({formatCRC(billing.amount)}) {dueText(billing)}.</strong>
            {billing.suspendDate && <span> Si no se registra el pago, el acceso se suspende el {billing.suspendDate}.</span>}
          </p>
          <button
            type="button"
            onClick={() => setQueue((q) => [{ type: "billing", billing }, ...q])}
            className="shrink-0 font-semibold underline underline-offset-2 cursor-pointer"
          >
            Cómo pagar
          </button>
        </div>
      )}

      {current && (
        <div
          role="dialog" aria-modal="true" aria-labelledby="tenant-notice-title"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            {current.type === "billing"
              ? <BillingNotice billing={current.billing} uploadHref={mensualidadHref} onNavigate={close} />
              : <ManualNotice notice={current.notice} plan={current.plan} uploadHref={mensualidadHref} onNavigate={close} />}
            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={close} autoFocus className="w-full">Entendido</Button>
              {queue.length > 1 && <p className="text-center text-xs text-brand-dark/40">Hay {queue.length - 1} aviso(s) más</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Heading({ icon: Icon, tone, label, title }: { icon: React.ElementType; tone: string; label: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${tone}`}>
        <Icon className="w-5 h-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/45">{label}</p>
        <h2 id="tenant-notice-title" className="font-brand text-lg font-bold text-brand-dark leading-snug">{title}</h2>
      </div>
    </div>
  );
}

interface UploadLink { uploadHref: string; onNavigate: () => void }

function BillingNotice({ billing, uploadHref, onNavigate }: { billing: Billing } & UploadLink) {
  const late = billing.status === "late";
  const { price } = billing;
  return (
    <>
      <Heading
        icon={Wallet} label="Mensualidad de Ennea"
        tone={late ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}
        title={`Tu mensualidad ${dueText(billing)}`}
      />
      <dl className="rounded-xl border border-brand-muted divide-y divide-brand-muted text-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-brand-dark/60">Plan {billing.planLabel} · {billing.period}</dt>
          <dd className={`tabular-nums ${price.discountAmount > 0 ? "text-brand-dark/45 line-through" : "text-brand-dark"}`}>{formatCRC(price.listAmount)}</dd>
        </div>
        {price.discountAmount > 0 && (
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-emerald-700">{price.discountLabel}</dt>
            <dd className="text-emerald-700 tabular-nums">−{formatCRC(price.listAmount - billing.amount)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="font-semibold text-brand-dark">Total a pagar</dt>
          <dd className="text-lg font-bold text-brand-dark tabular-nums">{formatCRC(billing.amount)}</dd>
        </div>
      </dl>
      <p className={`text-sm ${late ? "text-red-700" : "text-brand-dark/70"}`}>
        {late ? `Venció el ${billing.dueDate}.` : `Vence el ${billing.dueDate}.`}
        {billing.suspendDate && ` Si el pago no se registra, el panel y la tienda en línea se suspenden el ${billing.suspendDate}.`}
      </p>
      <HowToPay payment={billing.payment} uploadHref={uploadHref} onNavigate={onNavigate} />
    </>
  );
}

const KIND_STYLE: Record<NoticeKind, { icon: React.ElementType; tone: string }> = {
  info: { icon: Megaphone, tone: "bg-sky-100 text-sky-700" },
  cobro: { icon: Wallet, tone: "bg-amber-100 text-amber-700" },
  urgente: { icon: AlertTriangle, tone: "bg-red-100 text-red-700" },
};

function ManualNotice({ notice, plan, uploadHref, onNavigate }: { notice: Notice; plan: Plan | null } & UploadLink) {
  const style = KIND_STYLE[notice.kind] ?? KIND_STYLE.info;
  return (
    <>
      <Heading icon={style.icon} tone={style.tone} label="Aviso de Ennea" title={notice.title} />
      <p className="text-sm text-brand-dark/80 whitespace-pre-line">{notice.body}</p>
      {notice.kind === "cobro" && plan && (
        <>
          {!plan.price.free && (
            <p className="text-sm text-brand-dark/70">
              Tu mensualidad: Plan {plan.planLabel}, <strong className="text-brand-dark tabular-nums">{formatCRC(plan.price.amount)}</strong> al mes
              {plan.price.discountAmount > 0 && <span className="text-emerald-700"> ({plan.price.discountLabel})</span>}.
            </p>
          )}
          <HowToPay payment={plan.payment} uploadHref={uploadHref} onNavigate={onNavigate} />
        </>
      )}
    </>
  );
}

/** Cómo pagar y el botón para subir el comprobante en Mensualidad. */
function HowToPay({ payment, uploadHref, onNavigate }: { payment: PaymentInfo | null } & UploadLink) {
  const hasData = Boolean(payment && (payment.sinpeNumber || payment.iban || payment.notes));
  return (
    <div className="space-y-3">
      {hasData && payment ? (
        <div className="rounded-xl bg-brand-muted/40 px-4 py-3 text-sm text-brand-dark/80 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark/50">Cómo pagar</p>
          {payment.sinpeNumber && <p>SINPE Móvil: <strong>{payment.sinpeNumber}</strong>{payment.sinpeName && ` (${payment.sinpeName})`}</p>}
          {payment.iban && <p className="break-all">IBAN: <strong>{payment.iban}</strong>{payment.ibanName && ` (${payment.ibanName})`}</p>}
          {payment.notes && <p className="whitespace-pre-line">{payment.notes}</p>}
        </div>
      ) : (
        <p className="text-sm text-brand-dark/60">Los datos para pagar están en Mensualidad.</p>
      )}
      <Link
        href={uploadHref} onClick={onNavigate}
        className="flex items-center justify-center gap-2 w-full rounded-xl border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
      >
        <Upload className="w-4 h-4" aria-hidden /> Ya pagué: subir el comprobante
      </Link>
    </div>
  );
}
