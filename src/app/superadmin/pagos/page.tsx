"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, FilePlus2, Search } from "lucide-react";
import { PAYMENT_METHODS, formatCRC } from "@/lib/billing";
import { ownerStatusOf, type ReviewStatus } from "@/lib/mensualidad";
import { PaymentStateChip } from "@/components/superadmin/pagos/paymentStatus";
import ProofReviewDialog from "@/components/superadmin/pagos/ProofReviewDialog";
import PaymentsGrid from "@/components/superadmin/pagos/PaymentsGrid";

/**
 * Pagos de todos los negocios.
 * - Por revisar: los comprobantes que subieron los dueños desde Mensualidad, de cualquier mes.
 * - Por mes: las facturas de un mes (o de todos), con el registro de pago a mano.
 * - Por negocio: cuadrícula de negocios por meses.
 */

interface PaymentItem {
  _id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  status: string;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  listAmount?: number;
  discountAmount?: number;
  discountLabel?: string;
  method?: string;
  reference?: string;
  proofs?: { _id: string; status: string; uploadedAt: string }[];
  review?: { status?: ReviewStatus; submittedAt?: string | null };
}

type Tab = "revisar" | "mes" | "negocio";
const TABS: { id: Tab; label: string }[] = [
  { id: "revisar", label: "Por revisar" },
  { id: "mes", label: "Por mes" },
  { id: "negocio", label: "Por negocio" },
];

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const methodLabel = (method: string) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;

const stateOf = (p: PaymentItem) => ownerStatusOf(p);

/** "hace 3 h", "hace 2 días": cuánto lleva esperando un comprobante. */
function waiting(iso?: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export default function PagosPage() {
  const [tab, setTab]               = useState<Tab>("revisar");
  const [items, setItems]           = useState<PaymentItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatus]   = useState("");
  const [page, setPage]             = useState(1);
  const [acting, setActing]         = useState<string | null>(null);
  const [genMsg, setGenMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [limit, setLimit]           = useState(30);
  const [paying, setPaying]         = useState<PaymentItem | null>(null);
  const [reviewing, setReviewing]   = useState<string | null>(null);
  const [notice, setNotice]         = useState("");
  const [rowError, setRowError]     = useState("");
  const [search, setSearch]         = useState("");
  const [query, setQuery]           = useState("");
  const [reloadKey, setReloadKey]   = useState(0);

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Pestaña inicial desde la dirección (?tab=revisar|mes|negocio): el correo de aviso trae ?tab=revisar.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "revisar" || t === "mes" || t === "negocio") setTab(t);
  }, []);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    if (tab === "negocio") {
      // La cuadrícula trae lo suyo; acá solo hace falta el número de la pestaña "Por revisar".
      fetch("/api/superadmin/pagos/por-revisar").then((r) => r.json()).then((d) => setReviewCount(d.count ?? 0)).catch(() => {});
      return;
    }
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (tab === "revisar") q.set("review", "submitted");
    else {
      if (year) q.set("year", String(year));
      if (month) q.set("month", String(month));
      if (statusFilter) q.set("status", statusFilter);
    }
    if (query) q.set("q", query);
    fetch(`/api/superadmin/pagos?${q}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.payments ?? []);
        setTotal(d.total ?? 0);
        setLimit(d.limit ?? 30);
        setReviewCount(d.reviewCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, [tab, page, year, month, statusFilter, query]);

  useEffect(() => { load(); }, [load]);

  function switchTab(next: Tab) {
    setTab(next);
    setPage(1);
    setRowError("");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  async function generateAll() {
    if (!year || !month) return;
    if (!confirm(`¿Generar facturas para ${MONTHS[month - 1]} ${year}? Solo crea las que no existan.`)) return;
    setGenerating(true);
    setGenMsg(null);
    const res = await fetch("/api/superadmin/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generateAll: true, year, month }),
    });
    const d = await res.json();
    setGenerating(false);
    if (res.ok) {
      setGenMsg({ ok: true, text: `${d.created} facturas generadas` });
      load();
      setTimeout(() => setGenMsg(null), 4000);
    } else {
      setGenMsg({ ok: false, text: d.error ?? "Error al generar" });
    }
  }

  async function markStatus(id: string, status: string, extra: Record<string, unknown> = {}): Promise<string | null> {
    setActing(id);
    try {
      const res = await fetch(`/api/superadmin/pagos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error ?? "No se pudo cambiar la factura";
      if (d.reactivated) setNotice("Pago registrado: el negocio estaba suspendido por falta de pago y se reactivó.");
      load();
      return null;
    } catch {
      return "Error de red";
    } finally {
      setActing(null);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const totalAmount = items.reduce((s, p) => s + p.amount, 0);
  const paidAmount  = items.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const lateCount   = items.filter((p) => p.status === "late").length;

  return (
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Pagos</h1>
          <p className="sa-subtitle sa-num">
            {reviewCount > 0
              ? `${reviewCount} ${reviewCount === 1 ? "comprobante espera" : "comprobantes esperan"} revisión`
              : "Ningún comprobante espera revisión"}
          </p>
        </div>
        {tab === "mes" && (
          <div className="flex flex-wrap items-center gap-3">
            {genMsg && (
              <p role="status" className={`flex items-center gap-1.5 ${genMsg.ok ? "sa-success" : "sa-error"}`}>
                {genMsg.ok && <Check className="w-4 h-4" aria-hidden />}
                {genMsg.text}
              </p>
            )}
            <button type="button" onClick={generateAll} disabled={generating || !year || !month} className="sa-btn sa-btn-primary">
              <FilePlus2 className="w-4 h-4" aria-hidden />
              {generating ? "Generando..." : "Generar facturas del mes"}
            </button>
          </div>
        )}
      </header>

      <div className="sa-tabs" role="tablist" aria-label="Vistas de pagos">
        {TABS.map((t) => (
          <button
            key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id}
            aria-controls="pagos-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => switchTab(t.id)}
          >
            {t.label}
            {t.id === "revisar" && reviewCount > 0 && <span className="sa-nav-count ml-2 inline-block">{reviewCount}</span>}
          </button>
        ))}
      </div>

      {/* El ancho va en el label: .sa-input siempre ocupa todo el ancho de su contenedor. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="sa-field w-full sm:w-64">
          <span className="sa-label">Negocio</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 sa-muted" aria-hidden />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre"
              className="sa-input" style={{ paddingLeft: 34 }} maxLength={60}
            />
          </span>
        </label>
        {tab === "mes" && (
          <>
            <label className="sa-field w-[calc(50%-6px)] sm:w-32">
              <span className="sa-label">Mes</span>
              <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }} className="sa-input">
                <option value={0}>Todos</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="sa-field w-[calc(50%-6px)] sm:w-32">
              <span className="sa-label">Año</span>
              <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }} className="sa-input">
                <option value={0}>Todos</option>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="sa-field w-full sm:w-52">
              <span className="sa-label">Estado</span>
              <select value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sa-input">
                <option value="">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="paid">Pagados</option>
                <option value="late">Atrasados</option>
                <option value="cortesia">Cortesías</option>
                <option value="cancelled">Anulados</option>
              </select>
            </label>
          </>
        )}
      </div>

      {rowError && <p className="sa-alert sa-alert-danger" role="alert">{rowError}</p>}

      {notice && (
        <div className="sa-alert sa-alert-ok" role="status">
          <CheckCircle2 aria-hidden />
          <span>{notice}</span>
        </div>
      )}

      <div id="pagos-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-6">
        {tab === "negocio" && (
          <PaymentsGrid onOpen={(id) => { setNotice(""); setReviewing(id); }} reloadKey={reloadKey} query={search} />
        )}

        {tab === "revisar" && (
          <section className="sa-card overflow-hidden" aria-label="Comprobantes por revisar">
            {loading ? (
              <div className="sa-empty">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="sa-empty">{query ? "Ningún comprobante de ese negocio espera revisión." : "No hay comprobantes por revisar. Cuando un negocio suba uno, aparece acá."}</div>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Negocio</th>
                      <th>Mes</th>
                      <th className="sa-right">Tiene que pagar</th>
                      <th>Subido</th>
                      <th><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p._id} className="sa-row-clickable" onClick={() => { setNotice(""); setReviewing(p._id); }}>
                        <td>
                          <div className="min-w-[160px]">
                            <div className="sa-strong">{p.tenantName}</div>
                            <div className="sa-muted sa-mono">{p.tenantSlug}</div>
                          </div>
                        </td>
                        <td className="sa-num whitespace-nowrap">{MONTHS[p.periodMonth - 1]} {p.periodYear}</td>
                        <td className="sa-right sa-num whitespace-nowrap sa-strong">{formatCRC(p.amount)}</td>
                        <td className="sa-muted whitespace-nowrap">
                          {waiting(p.review?.submittedAt)}
                          {(p.proofs?.length ?? 0) > 1 && <span> · {p.proofs?.length} comprobantes</span>}
                        </td>
                        <td>
                          <button type="button" className="sa-btn sa-btn-sm sa-btn-primary" onClick={(e) => { e.stopPropagation(); setNotice(""); setReviewing(p._id); }}>
                            Revisar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "mes" && (
          <>
            {/* Resumen en una sola franja. El color va en un span interno porque .sa-stat-value fija su propio color. */}
            <section className="sa-card" aria-label="Resumen de las facturas en pantalla">
              <dl className="grid grid-cols-1 sm:grid-cols-3">
                <div className="px-5 py-4">
                  <dt className="sa-stat-label">Total facturado</dt>
                  <dd className="sa-stat-value">{formatCRC(totalAmount)}</dd>
                </div>
                <div className="px-5 py-4 border-t sm:border-t-0 sm:border-l border-[var(--sa-line)]">
                  <dt className="sa-stat-label">Total cobrado</dt>
                  <dd className="sa-stat-value"><span className="sa-ok-text">{formatCRC(paidAmount)}</span></dd>
                </div>
                <div className="px-5 py-4 border-t sm:border-t-0 sm:border-l border-[var(--sa-line)]">
                  <dt className="sa-stat-label">Morosos</dt>
                  <dd className="sa-stat-value">
                    {lateCount > 0 ? <span className="sa-danger-text">{lateCount}</span> : lateCount}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="sa-card overflow-hidden" aria-label="Facturas">
              {loading ? (
                <div className="sa-empty">Cargando...</div>
              ) : items.length === 0 ? (
                <div className="sa-empty">No hay facturas para este período.</div>
              ) : (
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Negocio</th>
                        <th>Período</th>
                        <th className="sa-right">Monto</th>
                        <th>Vence</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => {
                        const state = stateOf(p);
                        const open = p.status === "pending" || p.status === "late";
                        const hasProofs = (p.proofs?.length ?? 0) > 0;
                        const showPaid = p.status === "paid" && !!p.paidAt;
                        return (
                          <tr key={p._id}>
                            <td>
                              <div className="min-w-[160px]">
                                <div className="sa-strong">{p.tenantName}</div>
                                <div className="sa-muted sa-mono">{p.tenantSlug}</div>
                              </div>
                            </td>
                            <td className="sa-num whitespace-nowrap">
                              {MONTHS[p.periodMonth - 1]} {p.periodYear}
                            </td>
                            <td className="sa-right sa-num whitespace-nowrap">
                              <div className="sa-strong">{formatCRC(p.amount)}</div>
                              {(p.discountAmount ?? 0) > 0 && (
                                <div className="sa-muted text-xs" title={p.discountLabel}>
                                  lista {formatCRC(p.listAmount ?? p.amount)}
                                </div>
                              )}
                            </td>
                            <td className="sa-num whitespace-nowrap">
                              {new Date(p.dueDate).toLocaleDateString("es-CR")}
                            </td>
                            <td>
                              <PaymentStateChip status={state} />
                            </td>
                            <td>
                              {/* Sin flex-wrap: si no entran, la tabla se desplaza dentro de su caja en vez de apilar botones. */}
                              <div className="flex items-center gap-1.5">
                                {state === "revision" ? (
                                  <button type="button" onClick={() => { setNotice(""); setReviewing(p._id); }} className="sa-btn sa-btn-sm sa-btn-primary">
                                    Revisar
                                  </button>
                                ) : open && (
                                  <button
                                    type="button"
                                    onClick={() => { setNotice(""); setPaying(p); }}
                                    disabled={acting === p._id}
                                    className="sa-btn sa-btn-sm sa-btn-secondary"
                                  >
                                    Registrar pago
                                  </button>
                                )}
                                {hasProofs && state !== "revision" && (
                                  <button type="button" onClick={() => { setNotice(""); setReviewing(p._id); }} className="sa-btn sa-btn-sm sa-btn-ghost">
                                    {p.proofs!.length === 1 ? "Ver comprobante" : "Ver comprobantes"}
                                  </button>
                                )}
                                {p.status === "pending" && state !== "revision" && (
                                  <button
                                    type="button"
                                    onClick={async () => { setRowError(""); const e = await markStatus(p._id, "late"); if (e) setRowError(e); }}
                                    disabled={acting === p._id}
                                    className="sa-btn sa-btn-sm sa-btn-ghost"
                                  >
                                    Atrasar
                                  </button>
                                )}
                                {open && state !== "revision" && (
                                  <button
                                    type="button"
                                    onClick={() => { if (!confirm(`¿Pasar a cortesía la factura de ${p.tenantName} (${MONTHS[p.periodMonth - 1]} ${p.periodYear})? Queda en ₡0 y no se cobra. Para que los meses que vienen también sean sin costo, marcá "Sin costo (cortesía)" en la ficha del negocio.`)) return; setRowError(""); void markStatus(p._id, "cortesia").then((e) => { if (e) setRowError(e); }); }}
                                    disabled={acting === p._id}
                                    className="sa-btn sa-btn-sm sa-btn-ghost"
                                  >
                                    Cortesía
                                  </button>
                                )}
                                {open && (
                                  <button
                                    type="button"
                                    onClick={() => { if (!confirm(`¿Anular la factura de ${p.tenantName}? Deja de contar como pendiente y no dispara avisos.`)) return; setRowError(""); void markStatus(p._id, "cancelled").then((e) => { if (e) setRowError(e); }); }}
                                    disabled={acting === p._id}
                                    className="sa-btn sa-btn-sm sa-btn-ghost"
                                  >
                                    Anular
                                  </button>
                                )}
                                {showPaid && (
                                  <span className="sa-muted sa-num text-[13px] whitespace-nowrap">
                                    Pagó el {new Date(p.paidAt as string).toLocaleDateString("es-CR")}
                                    {p.method ? ` · ${methodLabel(p.method)}` : ""}
                                  </span>
                                )}
                                {!open && !showPaid && !hasProofs && <span className="sa-muted" aria-hidden>—</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {paying && (
        <MarkPaidDialog
          payment={paying}
          saving={acting === paying._id}
          onCancel={() => setPaying(null)}
          onConfirm={async (data) => {
            const error = await markStatus(paying._id, "paid", data);
            if (!error) setPaying(null);
            return error;
          }}
        />
      )}

      {reviewing && (
        <ProofReviewDialog
          paymentId={reviewing}
          onClose={() => setReviewing(null)}
          onChanged={(message) => {
            setReviewing(null);
            setNotice(message);
            setReloadKey((k) => k + 1);
            load();
          }}
        />
      )}

      {tab !== "negocio" && totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Páginas">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="sa-btn sa-btn-sm sa-btn-secondary"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
            Anterior
          </button>
          <span className="sa-muted sa-num">Página {page} de {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="sa-btn sa-btn-sm sa-btn-secondary"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

/** Registrar el pago de una factura: método y referencia (el comprobante del SINPE, por ejemplo). */
function MarkPaidDialog({
  payment, saving, onCancel, onConfirm,
}: {
  payment: PaymentItem;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (data: { method: string; reference: string }) => Promise<string | null>;
}) {
  const [method, setMethod] = useState("sinpe");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  return (
    <div className="sa-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pay-title" onClick={() => { if (!saving) onCancel(); }}>
      <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 id="pay-title" className="sa-modal-title">Registrar pago</h2>
          <p className="sa-muted mt-1">
            {payment.tenantName} · {MONTHS[payment.periodMonth - 1]} {payment.periodYear} · <span className="sa-strong sa-num">{formatCRC(payment.amount)}</span>
          </p>
        </div>
        <label className="sa-field">
          <span className="sa-label">Método</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="sa-input">
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="sa-field">
          <span className="sa-label">Referencia o comprobante (opcional)</span>
          <input value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} className="sa-input" />
        </label>
        {error && <p className="sa-error" role="alert">{error}</p>}
        <div className="sa-modal-actions">
          <button type="button" onClick={onCancel} disabled={saving} className="sa-btn sa-btn-ghost">Cancelar</button>
          <button
            type="button" disabled={saving}
            onClick={async () => { setError(""); const e = await onConfirm({ method, reference }); if (e) setError(e); }}
            className="sa-btn sa-btn-primary"
          >
            {saving ? "Guardando..." : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
