"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, CheckCircle2, XCircle, Search } from "lucide-react";

interface LogItem {
  _id: string;
  tenantSlug: string;
  tenantId: string;
  userEmail: string;
  ip: string;
  userAgent: string;
  success: boolean;
  createdAt: string;
}

export default function ActividadPage() {
  const [logs, setLogs]     = useState<LogItem[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState("");
  const [success, setSuccess] = useState("");
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState("");
  const [page, setPage]     = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (tenant)  q.set("tenantSlug", tenant);
    if (success) q.set("success", success);
    if (from)    q.set("from", from);
    if (to)      q.set("to", to);
    fetch(`/api/superadmin/actividad?${q}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.logs ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [tenant, success, from, to, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Actividad</h1>
        <p className="text-white/40 text-sm mt-1">{total} registros de acceso</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Tenant search */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[180px]"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            value={tenant}
            onChange={(e) => { setTenant(e.target.value); setPage(1); }}
            placeholder="Filtrar por tenant..."
            className="bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none flex-1"
          />
        </div>

        {/* Success filter */}
        <select
          value={success}
          onChange={(e) => { setSuccess(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <option value="">Todos</option>
          <option value="true">Exitosos</option>
          <option value="false">Fallidos</option>
        </select>

        {/* Date range */}
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
        />

        {(tenant || success || from || to) && (
          <button
            onClick={() => { setTenant(""); setSuccess(""); setFrom(""); setTo(""); setPage(1); }}
            className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer px-2"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="grid grid-cols-[90px_1fr_140px_100px_160px] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/30"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span>Resultado</span>
          <span>Usuario</span>
          <span>Tenant</span>
          <span>IP</span>
          <span>Fecha</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-white/30 text-sm">Cargando...</div>
        ) : logs.length === 0 ? (
          <div
            className="px-5 py-12 flex flex-col items-center gap-3"
          >
            <Activity className="w-8 h-8 text-white/20" />
            <p className="text-white/30 text-sm">Sin registros</p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={log._id}
              className="grid grid-cols-[90px_1fr_140px_100px_160px] px-5 py-3 items-center text-sm"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
            >
              <div className="flex items-center gap-2">
                {log.success
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span className={`text-xs font-semibold ${log.success ? "text-emerald-400" : "text-red-400"}`}>
                  {log.success ? "OK" : "Falló"}
                </span>
              </div>
              <span className="text-white/70 text-xs font-mono truncate pr-3">{log.userEmail || "—"}</span>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-md w-fit"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              >
                /{log.tenantSlug}
              </span>
              <span className="text-white/35 text-xs font-mono">{log.ip}</span>
              <span className="text-white/35 text-xs">
                {new Date(log.createdAt).toLocaleString("es-CR", {
                  day: "2-digit", month: "2-digit", year: "2-digit",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
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
