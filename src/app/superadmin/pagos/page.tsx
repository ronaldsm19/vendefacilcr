"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, Ban, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clock, FilePlus2, Gift,
  type LucideIcon,
} from "lucide-react";
import { PAYMENT_METHODS, formatCRC } from "@/lib/billing";

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
}

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// Cada estado lleva ícono y texto: el color solo no alcanza para distinguirlos.
const STATUS_CHIPS: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  pending:   { label: "Pendiente", className: "sa-chip sa-chip-warn",   icon: Clock },
  paid:      { label: "Pagado",    className: "sa-chip sa-chip-ok",     icon: Check },
  late:      { label: "Atrasado",  className: "sa-chip sa-chip-danger", icon: AlertTriangle },
  cancelled: { label: "Anulado",   className: "sa-chip",                icon: Ban },
  cortesia:  { label: "Cortesía",  className: "sa-chip sa-chip-info",   icon: Gift },
};

const methodLabel = (method: string) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;

export default function PagosPage() {
  const [items, setItems]           = useState<PaymentItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatus]   = useState("");
  const [page, setPage]             = useState(1);
  const [acting, setActing]         = useState<string | null>(null);
  const [genMsg, setGenMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [limit, setLimit]           = useState(30);
  const [paying, setPaying]         = useState<PaymentItem | null>(null);
  const [notice, setNotice]         = useState("");
  const [rowError, setRowError]     = useState("");

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), year: String(year), month: String(month) });
    if (statusFilter) q.set("status", statusFilter);
    fetch(`/api/superadmin/pagos?${q}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.payments ?? []); setTotal(d.total ?? 0); setLimit(d.limit ?? 30); })
      .finally(() => setLoading(false));
  }, [page, year, month, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function generateAll() {
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
          <p className="sa-subtitle sa-num">{total} {total === 1 ? "factura" : "facturas"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {genMsg && (
            <p role="status" className={`flex items-center gap-1.5 ${genMsg.ok ? "sa-success" : "sa-error"}`}>
              {genMsg.ok && <Check className="w-4 h-4" aria-hidden />}
              {genMsg.text}
            </p>
          )}
          <button type="button" onClick={generateAll} disabled={generating} className="sa-btn sa-btn-primary">
            <FilePlus2 className="w-4 h-4" aria-hidden />
            {generating ? "Generando..." : "Generar facturas del mes"}
          </button>
        </div>
      </header>

      {/* El ancho va en el label: .sa-input siempre ocupa todo el ancho de su contenedor. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="sa-field w-[calc(50%-6px)] sm:w-32">
          <span className="sa-label">Mes</span>
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }}
            className="sa-input"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </label>
        <label className="sa-field w-[calc(50%-6px)] sm:w-32">
          <span className="sa-label">Año</span>
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
            className="sa-input"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="sa-field w-full sm:w-52">
          <span className="sa-label">Estado</span>
          <select
            value={statusFilter}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="sa-input"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="paid">Pagados</option>
            <option value="late">Atrasados</option>
            <option value="cortesia">Cortesías</option>
          </select>
        </label>
      </div>

      {rowError && <p className="sa-alert sa-alert-danger" role="alert">{rowError}</p>}

      {notice && (
        <div className="sa-alert sa-alert-ok" role="status">
          <CheckCircle2 aria-hidden />
          <span>{notice}</span>
        </div>
      )}

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
                  const canPay = p.status === "pending" || p.status === "late";
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
                        <StatusChip status={p.status} />
                      </td>
                      <td>
                        {/* Sin flex-wrap: si no entran, la tabla se desplaza dentro de su caja en vez de apilar botones. */}
                        <div className="flex items-center gap-1.5">
                          {canPay && (
                            <button
                              type="button"
                              onClick={() => { setNotice(""); setPaying(p); }}
                              disabled={acting === p._id}
                              className="sa-btn sa-btn-sm sa-btn-secondary"
                            >
                              Registrar pago
                            </button>
                          )}
                          {p.status === "pending" && (
                            <button
                              type="button"
                              onClick={async () => { setRowError(""); const e = await markStatus(p._id, "late"); if (e) setRowError(e); }}
                              disabled={acting === p._id}
                              className="sa-btn sa-btn-sm sa-btn-ghost"
                            >
                              Atrasar
                            </button>
                          )}
                          {canPay && (
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
                          {!canPay && !showPaid && <span className="sa-muted" aria-hidden>—</span>}
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

      {totalPages > 1 && (
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

function StatusChip({ status }: { status: string }) {
  const chip = STATUS_CHIPS[status];
  if (!chip) return <span className="sa-chip"><CircleHelp aria-hidden />{status}</span>;
  const Icon = chip.icon;
  return <span className={chip.className}><Icon aria-hidden />{chip.label}</span>;
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
