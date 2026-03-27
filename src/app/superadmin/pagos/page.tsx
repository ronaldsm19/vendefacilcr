"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, Zap, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

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
}

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-500/20 text-amber-400",
  paid:      "bg-emerald-500/20 text-emerald-400",
  late:      "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", paid: "Pagado", late: "Atrasado", cancelled: "Cancelado",
};

export default function PagosPage() {
  const [items, setItems]           = useState<PaymentItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatus]   = useState("");
  const [page, setPage]             = useState(1);
  const [acting, setActing]         = useState<string | null>(null);
  const [genMsg, setGenMsg]         = useState("");

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), year: String(year), month: String(month) });
    if (statusFilter) q.set("status", statusFilter);
    fetch(`/api/superadmin/pagos?${q}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page, year, month, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function generateAll() {
    if (!confirm(`¿Generar facturas para ${MONTHS[month - 1]} ${year}? Solo crea las que no existan.`)) return;
    setGenerating(true);
    setGenMsg("");
    const res = await fetch("/api/superadmin/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generateAll: true, year, month }),
    });
    const d = await res.json();
    setGenerating(false);
    if (res.ok) {
      setGenMsg(`✓ ${d.created} facturas generadas`);
      load();
      setTimeout(() => setGenMsg(""), 4000);
    } else {
      setGenMsg(d.error ?? "Error al generar");
    }
  }

  async function markStatus(id: string, status: string) {
    setActing(id);
    await fetch(`/api/superadmin/pagos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActing(null);
    load();
  }

  const totalPages = Math.ceil(total / 20);
  const totalAmount = items.reduce((s, p) => s + p.amount, 0);
  const paidAmount  = items.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const lateCount   = items.filter((p) => p.status === "late").length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Pagos</h1>
          <p className="text-white/40 text-sm mt-1">{total} registros</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {genMsg && (
            <p className={`text-sm ${genMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
              {genMsg}
            </p>
          )}
          <button
            onClick={generateAll}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl saas-accent-bg text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            {generating ? "Generando..." : "Generar facturas del mes"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Month picker */}
        <select
          value={month}
          onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="paid">Pagados</option>
          <option value="late">Atrasados</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total facturado"
          value={`₡${totalAmount.toLocaleString("es-CR")}`}
          icon={CreditCard}
          color="blue"
        />
        <SummaryCard
          label="Total cobrado"
          value={`₡${paidAmount.toLocaleString("es-CR")}`}
          icon={CheckCircle2}
          color="green"
        />
        <SummaryCard
          label="Morosos"
          value={lateCount}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="grid grid-cols-[1fr_100px_100px_100px_120px_130px] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/30"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span>Tenant</span>
          <span>Período</span>
          <span>Monto</span>
          <span>Vence</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-white/30 text-sm">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-white/30 text-sm">Sin pagos para este período</div>
        ) : (
          items.map((p, i) => (
            <div
              key={p._id}
              className="grid grid-cols-[1fr_100px_100px_100px_120px_130px] px-5 py-3.5 items-center text-sm"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
            >
              <div>
                <p className="font-medium text-white/80">{p.tenantName}</p>
                <p className="text-white/35 text-xs mt-0.5">{p.tenantSlug}</p>
              </div>
              <span className="text-white/50 text-xs font-mono">
                {MONTHS[p.periodMonth - 1]} {p.periodYear}
              </span>
              <span className="text-white/80 text-xs font-semibold">
                ₡{p.amount.toLocaleString("es-CR")}
              </span>
              <span className="text-white/40 text-xs">
                {new Date(p.dueDate).toLocaleDateString("es-CR")}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${STATUS_COLORS[p.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                {STATUS_LABELS[p.status] ?? p.status}
              </span>
              <div className="flex items-center gap-2">
                {p.status !== "paid" && (
                  <button
                    onClick={() => markStatus(p._id, "paid")}
                    disabled={acting === p._id}
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {acting === p._id ? "..." : "Marcar pagado"}
                  </button>
                )}
                {p.status === "pending" && (
                  <button
                    onClick={() => markStatus(p._id, "late")}
                    disabled={acting === p._id}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Atrasar
                  </button>
                )}
                {p.status === "paid" && p.paidAt && (
                  <span className="text-white/30 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(p.paidAt).toLocaleDateString("es-CR")}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            ← Anterior
          </button>
          <span className="text-white/30 text-sm">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: string | number; icon: React.ElementType; color: "blue" | "green" | "red";
}) {
  const palette = {
    blue:  { bg: "rgba(59,130,246,0.1)",  text: "text-blue-400",    border: "rgba(59,130,246,0.2)"  },
    green: { bg: "rgba(16,185,129,0.1)",  text: "text-emerald-400", border: "rgba(16,185,129,0.2)"  },
    red:   { bg: "rgba(239,68,68,0.1)",   text: "text-red-400",     border: "rgba(239,68,68,0.2)"   },
  }[color];
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
      >
        <Icon className={`w-4 h-4 ${palette.text}`} />
      </div>
      <p className={`text-xl font-bold ${palette.text}`}>{value}</p>
      <p className="text-white/50 text-sm mt-1">{label}</p>
    </div>
  );
}
