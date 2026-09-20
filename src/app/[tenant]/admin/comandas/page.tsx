"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PeriodFilter, { getRange, type PeriodMode } from "@/components/admin/PeriodFilter";
import Pagination from "@/components/admin/Pagination";
import ComandaCard, { type ComandaRow } from "@/components/admin/ComandaCard";
import CancelComandaDialog from "@/components/admin/CancelComandaDialog";
import { useAdminSession } from "@/components/admin/SessionContext";
import { usePolling } from "@/hooks/usePolling";
import { DEFAULT_COMANDA_CONFIG, type ComandaConfigData } from "@/lib/comandaConfig";
import { comandaMinutes, badgeLevel, BADGE_COLORS, type ComandaThresholds } from "@/lib/comandaTime";
import { AlertTriangle, CheckCheck, Ban, Pencil, Eye, Printer, Check } from "lucide-react";

const STATUS_PILL: Record<ComandaRow["status"], string> = {
  enviada: "bg-blue-50 text-blue-700",
  servida: "bg-emerald-50 text-emerald-700",
  pagada: "bg-brand-muted text-brand-dark/60",
  anulada: "bg-red-50 text-red-600",
};
const STATUS_LABEL: Record<ComandaRow["status"], string> = {
  enviada: "Enviada", servida: "Servida", pagada: "Pagada", anulada: "Anulada",
};

type Tab = "historial" | "pendientes";
type StatusFilter = "" | "open" | "enviada" | "servida" | "pagada" | "anulada";

interface FilterTable { _id: string; label: string; areaName: string; }
interface FilterWaiter { waiterId: string; waiterName: string; }

function isOpenStatus(c: ComandaRow) {
  return c.status === "enviada" || c.status === "servida";
}
function hasPaidItems(c: ComandaRow) {
  return c.items.some((i) => i.paidQty > 0);
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-CR", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
}

function TiempoBadge({ comanda, thresholds, now }: { comanda: ComandaRow; thresholds: ComandaThresholds; now: Date }) {
  const minutes = comandaMinutes(comanda, now);
  if (minutes === null) return <span className="text-brand-dark/30">—</span>;
  const level = badgeLevel(minutes, thresholds);
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ background: BADGE_COLORS[level].bg, color: BADGE_COLORS[level].text }}
    >
      {minutes}′
    </span>
  );
}

const selectClass = "border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink text-brand-dark bg-white";

export default function AdminComandasPage() {
  const { role, tenantSlug } = useAdminSession();
  const router = useRouter();
  const isStaffView = role !== "mesero";

  const [tab, setTab] = useState<Tab>("historial");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("dia");
  const [anchor, setAnchor] = useState(() => new Date());
  const [tableFilter, setTableFilter] = useState("");
  const [waiterFilter, setWaiterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [comandas, setComandas] = useState<ComandaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const [filterTables, setFilterTables] = useState<FilterTable[]>([]);
  const [filterWaiters, setFilterWaiters] = useState<FilterWaiter[]>([]);
  const [comandaConfig, setComandaConfig] = useState<ComandaConfigData>(DEFAULT_COMANDA_CONFIG);

  const [selected, setSelected] = useState<ComandaRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ComandaRow | null>(null);
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [reprintMsg, setReprintMsg] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    if (tab === "pendientes") {
      params.set("pending", "1");
    } else {
      const { from, to } = getRange(periodMode, anchor);
      params.set("from", from.toISOString());
      params.set("to", to.toISOString());
      if (tableFilter) params.set("tableId", tableFilter);
      if (isStaffView && waiterFilter) params.set("waiterId", waiterFilter);
      if (statusFilter === "open") params.set("open", "1");
      else if (statusFilter) params.set("status", statusFilter);
    }

    const mainReq = fetch(`/api/admin/comandas?${params.toString()}`).then((r) => r.json());
    const pendingReq = isStaffView && tab !== "pendientes"
      ? fetch("/api/admin/comandas?pending=1&limit=1").then((r) => r.json()).catch(() => null)
      : Promise.resolve(null);

    const [data, pendingData] = await Promise.all([mainReq, pendingReq]);
    const rows: ComandaRow[] = data.comandas ?? [];
    setComandas(rows);
    setTotal(data.total ?? 0);
    if (tab === "pendientes") setPendingCount(data.total ?? 0);
    else if (pendingData) setPendingCount(pendingData.total ?? 0);
    setSelected((prev) => (prev ? rows.find((c) => c._id === prev._id) ?? prev : prev));
    setNow(new Date());
    setLoading(false);
  }, [tab, page, pageSize, periodMode, anchor, tableFilter, waiterFilter, statusFilter, isStaffView]);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 10000, true);

  useEffect(() => {
    fetch("/api/admin/comandas/filters").then((r) => r.json()).then((d) => {
      setFilterTables(d.tables ?? []);
      setFilterWaiters(d.waiters ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/salon/live").then((r) => r.json()).then((d) => {
      if (d.comandaConfig) setComandaConfig(d.comandaConfig);
    }).catch(() => {});
  }, []);

  function handleTab(t: Tab) { setTab(t); setPage(1); }
  function handlePeriod(m: PeriodMode, a: Date) { setPeriodMode(m); setAnchor(a); setPage(1); }
  function handleTableFilter(v: string) { setTableFilter(v); setPage(1); }
  function handleWaiterFilter(v: string) { setWaiterFilter(v); setPage(1); }
  function handleStatusFilter(v: StatusFilter) { setStatusFilter(v); setPage(1); }

  async function handleServe(id: string) {
    await fetch(`/api/admin/comandas/${id}/serve`, { method: "POST" });
    await load();
  }

  function handleEdit(c: ComandaRow) {
    router.push(`/${tenantSlug}/admin/salon/${c.tableId}/comanda?edit=${c._id}`);
  }

  function handleCancelDone() {
    setCancelTarget(null);
    load();
  }

  async function handleReprint(id: string) {
    setReprintingId(id);
    try {
      const res = await fetch(`/api/admin/comandas/${id}/reprint`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setReprintMsg({ type: "error", text: d.error ?? "No se pudo reimprimir" });
      } else if (d.jobs.length === 0) {
        setReprintMsg({ type: "warning", text: "Esta comanda no tiene ítems para imprimir" });
      } else if (d.jobs.length === 2) {
        setReprintMsg({ type: "success", text: "Enviado a impresión: COCINA y BEBIDAS" });
      } else {
        setReprintMsg({ type: "success", text: `Enviado a impresión: ${d.jobs[0].station === "cocina" ? "COCINA" : "BEBIDAS"}` });
      }
    } finally {
      setReprintingId(null);
      setTimeout(() => setReprintMsg(null), 3000);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const emptyMessage = tab === "pendientes" ? "No hay comandas pendientes de cobro." : "No hay comandas en este período.";

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Comandas</h1>
        <p className="text-brand-dark/50 text-sm mt-1">{total} comandas en el período</p>
      </div>

      {/* Tabs */}
      {isStaffView && (
        <div className="flex gap-2">
          <button
            onClick={() => handleTab("historial")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
              tab === "historial" ? "gradient-bg text-white border-transparent" : "bg-white text-brand-dark/60 border-brand-muted hover:border-brand-pink/30"
            }`}
          >
            Historial
          </button>
          <button
            onClick={() => handleTab("pendientes")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
              tab === "pendientes" ? "gradient-bg text-white border-transparent" : "bg-white text-brand-dark/60 border-brand-muted hover:border-brand-pink/30"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Pendientes de cobro
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Filtros */}
      {tab === "historial" && (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <PeriodFilter mode={periodMode} anchor={anchor} onChange={handlePeriod} />
          <div className="flex flex-wrap gap-2">
            <select value={tableFilter} onChange={(e) => handleTableFilter(e.target.value)} className={selectClass}>
              <option value="">Todas las mesas</option>
              {filterTables.map((t) => (
                <option key={t._id} value={t._id}>{t.areaName ? `${t.areaName} · ` : ""}Mesa {t.label}</option>
              ))}
            </select>
            {isStaffView && (
              <select value={waiterFilter} onChange={(e) => handleWaiterFilter(e.target.value)} className={selectClass}>
                <option value="">Todos</option>
                {filterWaiters.map((w) => (
                  <option key={w.waiterId} value={w.waiterId}>{w.waiterName}</option>
                ))}
              </select>
            )}
            <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value as StatusFilter)} className={selectClass}>
              <option value="">Todos</option>
              <option value="open">Abiertas</option>
              <option value="enviada">Enviada</option>
              <option value="servida">Servida</option>
              <option value="pagada">Pagada</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>
        </div>
      )}

      {tab === "pendientes" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
          Estas comandas son de días anteriores y siguen abiertas. Anulalas o cobrálas en el POS.
        </div>
      )}

      {reprintMsg && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm border ${
          reprintMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
          reprintMsg.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-700" :
          "bg-red-50 border-red-200 text-red-700"
        }`}>
          {reprintMsg.type === "success" && <Check className="w-4 h-4 shrink-0" />}
          {reprintMsg.text}
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Hora</th>
                  <th className="text-left px-4 py-3">Mesa</th>
                  <th className="text-left px-4 py-3">Mesero</th>
                  <th className="text-left px-4 py-3">Ítems</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Tiempo</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comandas.map((c) => (
                  <tr key={c._id} className="border-b border-brand-muted/50 hover:bg-brand-muted/20">
                    <td className="px-4 py-3 font-semibold text-brand-dark">#{c.number}</td>
                    <td className="px-4 py-3 text-brand-dark/60 text-xs">{fmtDateTime(c.sentAt)}</td>
                    <td className="px-4 py-3 text-brand-dark/70">{c.areaName ? `${c.areaName} · ` : ""}Mesa {c.tableLabel}</td>
                    <td className="px-4 py-3 text-brand-dark/70">{c.waiterName}</td>
                    <td className="px-4 py-3 text-brand-dark/70">{c.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    </td>
                    <td className="px-4 py-3"><TiempoBadge comanda={c} thresholds={comandaConfig} now={now} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => setSelected(c)}>
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                        {isStaffView && c.status !== "anulada" && (
                          <button
                            onClick={() => handleReprint(c._id)}
                            disabled={reprintingId === c._id}
                            title="Reimprimir"
                            className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/40 hover:text-brand-pink transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {tab === "pendientes" ? (
                          <>
                            {!hasPaidItems(c) && (
                              <button
                                onClick={() => setCancelTarget(c)}
                                title="Anular"
                                className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/40 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            <Button asChild size="sm">
                              <Link href={`/${tenantSlug}/admin/pos`}>Ir a cobrar</Link>
                            </Button>
                          </>
                        ) : (
                          <>
                            {c.status === "enviada" && (
                              <button
                                onClick={() => handleServe(c._id)}
                                title="Marcar servida"
                                className="p-1.5 rounded-lg hover:bg-emerald-50 text-brand-dark/40 hover:text-emerald-600 transition-colors cursor-pointer"
                              >
                                <CheckCheck className="w-4 h-4" />
                              </button>
                            )}
                            {isOpenStatus(c) && !hasPaidItems(c) && (
                              <button
                                onClick={() => setCancelTarget(c)}
                                title="Anular"
                                className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/40 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {comandas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-brand-dark/40">{emptyMessage}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Móvil */}
          <div className="md:hidden p-3 space-y-3">
            {comandas.map((c) => (
              <div key={c._id} className="space-y-1.5">
                <ComandaCard
                  comanda={c}
                  thresholds={comandaConfig}
                  now={now}
                  compact
                  onOpen={() => setSelected(c)}
                  onServe={tab === "historial" && c.status === "enviada" ? () => handleServe(c._id) : undefined}
                  onCancel={isOpenStatus(c) && !hasPaidItems(c) ? () => setCancelTarget(c) : undefined}
                />
                {tab === "pendientes" && (
                  <Button asChild size="sm" variant="secondary" className="w-full">
                    <Link href={`/${tenantSlug}/admin/pos`}>Ir a cobrar</Link>
                  </Button>
                )}
              </div>
            ))}
            {comandas.length === 0 && (
              <p className="text-center text-brand-dark/40 py-8">{emptyMessage}</p>
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={(s) => { setPageSize(s); setPage(1); }}
            totalItems={total}
          />
        </div>
      )}

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Comanda #{selected?.number}</DialogTitle></DialogHeader>
          {selected && (
            <div className="px-6 pb-6 pt-2 space-y-4">
              <ComandaCard comanda={selected} thresholds={comandaConfig} now={now} />

              <div className="text-xs text-brand-dark/60 space-y-1">
                <p>Enviada {fmtTime(selected.sentAt)}</p>
                {selected.servedAt && <p>Servida {fmtTime(selected.servedAt)} por {selected.servedBy}</p>}
                {selected.cancelledAt && (
                  <p>Anulada {fmtTime(selected.cancelledAt)} por {selected.cancelledBy}{selected.cancelReason ? `: ${selected.cancelReason}` : ""}</p>
                )}
                {selected.paidAt && <p>Pagada {fmtTime(selected.paidAt)}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.status === "enviada" && (
                  <Button size="sm" onClick={() => handleServe(selected._id)}>
                    <CheckCheck className="w-3.5 h-3.5" /> Servida
                  </Button>
                )}
                {isOpenStatus(selected) && !hasPaidItems(selected) && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(selected)}>
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="bg-red-50 text-red-600 hover:bg-red-100" onClick={() => setCancelTarget(selected)}>
                      <Ban className="w-3.5 h-3.5" /> Anular
                    </Button>
                  </>
                )}
                {isStaffView && selected.status !== "anulada" && (
                  <Button size="sm" variant="secondary" disabled={reprintingId === selected._id} onClick={() => handleReprint(selected._id)}>
                    <Printer className="w-3.5 h-3.5" /> Reimprimir
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {cancelTarget && (
        <CancelComandaDialog comanda={cancelTarget} onClose={() => setCancelTarget(null)} onDone={handleCancelDone} />
      )}
    </div>
  );
}
