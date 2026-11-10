"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";

interface LogItem {
  _id: string;
  tenantSlug: string;
  tenantId: string;
  userEmail: string;
  ip: string;
  userAgent: string;
  success: boolean;
  event?: "login" | "visit";
  path?: string;
  createdAt: string;
}

const RESULT_FILTERS = [
  { value: "",      label: "Todos" },
  { value: "true",  label: "Exitosos" },
  { value: "false", label: "Fallidos" },
];

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
    if (tenant)  q.set("tenantSlug", tenant.trim());
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
  const hasFilters = Boolean(tenant || success || from || to);

  return (
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Actividad</h1>
          <p className="sa-subtitle sa-num">
            {total} {total === 1 ? "registro de acceso" : "registros de acceso"}
          </p>
        </div>
      </header>

      {/* Los anchos van en el contenedor de cada campo: .sa-input siempre ocupa todo su ancho. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="sa-field w-full sm:w-auto sm:flex-[1_1_220px]">
          <span className="sa-label">Negocio</span>
          <input
            value={tenant}
            onChange={(e) => { setTenant(e.target.value); setPage(1); }}
            placeholder="Filtrar por negocio..."
            className="sa-input"
          />
        </label>

        <div className="sa-field">
          <span className="sa-label" id="actividad-resultado">Resultado</span>
          <div className="sa-seg" role="group" aria-labelledby="actividad-resultado">
            {RESULT_FILTERS.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={success === r.value}
                onClick={() => { setSuccess(r.value); setPage(1); }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <label className="sa-field flex-[1_1_140px] sm:flex-[0_0_160px]">
          <span className="sa-label">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="sa-input"
          />
        </label>
        <label className="sa-field flex-[1_1_140px] sm:flex-[0_0_160px]">
          <span className="sa-label">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="sa-input"
          />
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setTenant(""); setSuccess(""); setFrom(""); setTo(""); setPage(1); }}
            className="sa-btn sa-btn-ghost"
          >
            Limpiar
          </button>
        )}
      </div>

      <section className="sa-card overflow-hidden" aria-label="Registros de acceso">
        {loading ? (
          <div className="sa-empty">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="sa-empty">
            {hasFilters ? "No hay registros con esos filtros." : "No hay registros de acceso."}
          </div>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Usuario</th>
                  <th>Negocio</th>
                  <th>Ruta</th>
                  <th>IP y agente</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isVisit = log.event === "visit";
                  return (
                    <tr key={log._id}>
                      <td>
                        {isVisit ? (
                          <span className="sa-chip"><Eye aria-hidden />Visita</span>
                        ) : log.success ? (
                          <span className="sa-chip sa-chip-ok"><Check aria-hidden />Ingreso correcto</span>
                        ) : (
                          <span className="sa-chip sa-chip-danger"><X aria-hidden />Ingreso fallido</span>
                        )}
                      </td>
                      <td>
                        <span className="block max-w-[260px] truncate" title={log.userEmail || undefined}>
                          {log.userEmail || "—"}
                        </span>
                      </td>
                      <td className="sa-mono whitespace-nowrap">/{log.tenantSlug}</td>
                      {/* El gris va en un span: dentro de .sa-table la celda fija su propio color. */}
                      <td>
                        <span className="sa-mono sa-muted block max-w-[220px] truncate" title={log.path}>
                          {log.path ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span className="sa-mono sa-muted whitespace-nowrap">{log.ip}</span>
                        {log.userAgent && (
                          <span className="sa-muted block max-w-[240px] truncate text-xs" title={log.userAgent}>
                            {log.userAgent}
                          </span>
                        )}
                      </td>
                      <td className="sa-num whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("es-CR", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
