"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CircleAlert, RefreshCw, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// ── Tipos de la respuesta de /api/superadmin/errores ───────────────────────────

type Level = "error" | "aviso";
type Source = "navegador" | "servidor" | "agente";
type Kind = "respuesta" | "sin_conexion" | "excepcion" | "agente_rechazado";
type Period = "24h" | "7d" | "30d" | "90d";

interface EventRow {
  _id: string;
  tenantId: string | null;
  tenantSlug: string;
  source: Source;
  level: Level;
  kind: Kind;
  method: string;
  route: string;
  status: number | null;
  message: string;
  code: string;
  page: string;
  userName: string;
  userRole: string;
  userAgent: string;
  stack: string;
  digest: string;
  appVersion: string;
  count: number;
  firstAt: string;
  lastAt: string;
}

interface PanelData {
  periodo: Period;
  resumen: { errores: number; avisos: number; negocios: number; ultimoError: { lastAt: string; message: string; route: string } | null };
  serie: { label: string; errores: number; avisos: number }[];
  porApi: { _id: { method: string; route: string; source: Source }; errores: number; avisos: number; negocios: number; ultimo: string; mensaje: string }[];
  porNegocio: { _id: string | null; tenantSlug: string; errores: number; avisos: number; ultimo: string; apiTop: { method: string; route: string } }[];
  mensajes: { _id: { message: string; route: string; level: Level }; veces: number; negocios: number; ultimo: string }[];
  ultimos: EventRow[];
  negocios: Record<string, { name: string; slug: string }>;
  listaNegocios: { _id: string; name: string; slug: string }[];
}

// ── Textos ─────────────────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
];
const SOURCE_LABEL: Record<Source, string> = { navegador: "Navegador", servidor: "Servidor", agente: "Agente" };
const KIND_LABEL: Record<Kind, string> = {
  respuesta: "Respuesta con error",
  sin_conexion: "Sin respuesta (conexión)",
  excepcion: "Falla del servidor",
  agente_rechazado: "Agente de impresión rechazado",
};
const ROLE_LABEL: Record<string, string> = { admin: "Administrador", cajero: "Cajero", mesero: "Mesero" };
type Tab = "api" | "negocio" | "mensajes" | "ultimos";
const TABS: { value: Tab; label: string }[] = [
  { value: "api", label: "Por API" },
  { value: "negocio", label: "Por negocio" },
  { value: "mensajes", label: "Mensajes" },
  { value: "ultimos", label: "Últimos" },
];

// El gráfico recibe los colores como valores (no como clases): son los del tema claro.
const CHART = { errores: "#C2321F", avisos: "#D98E04", grid: "#E3E5E8", axis: "#5B6270", ink: "#14171C", surface: "#FFFFFF", cursor: "#F1F3F6" };

const STAT_CELL = "flex flex-col gap-1 min-w-0 p-4 sm:p-5 bg-[var(--sa-surface)]";
// Botón dentro de una fila clicable: permite llegar a la fila con el teclado. Su clic sube a la fila.
const ROW_BUTTON = "text-left cursor-pointer hover:underline";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CR", { day: "2-digit", month: "2-digit", hour: "numeric", minute: "2-digit" });
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

function seriesTick(label: string, period: Period): string {
  if (period === "24h") {
    const hour = Number(label.slice(11, 13));
    return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`;
  }
  return `${label.slice(8, 10)}/${label.slice(5, 7)}`;
}

function LevelChip({ level }: { level: Level }) {
  return level === "error" ? (
    <span className="sa-chip sa-chip-danger"><CircleAlert aria-hidden />Error</span>
  ) : (
    <span className="sa-chip sa-chip-warn"><AlertTriangle aria-hidden />Aviso</span>
  );
}

function Num({ value, tone }: { value: number; tone: "error" | "aviso" }) {
  if (!value) return <span className="sa-num sa-muted">0</span>;
  return <span className={`sa-num font-semibold ${tone === "error" ? "sa-danger-text" : "sa-warn-text"}`}>{value.toLocaleString("es-CR")}</span>;
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function ErroresPanel() {
  const params = useSearchParams();
  const [period, setPeriod] = useState<Period>("7d");
  const [tenant, setTenant] = useState(() => params.get("negocio") ?? "");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("api");
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<EventRow | null>(null);

  // La búsqueda se manda al dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ periodo: period });
    if (tenant) qs.set("negocio", tenant);
    if (level) qs.set("nivel", level);
    if (source) qs.set("origen", source);
    if (q) qs.set("q", q);
    try {
      const res = await fetch(`/api/superadmin/errores?${qs}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "No se pudo cargar el panel"); return; }
      setData(json);
    } catch {
      setError("No se pudo cargar el panel. Revisá tu conexión.");
    } finally {
      setLoading(false);
    }
  }, [period, tenant, level, source, q]);

  useEffect(() => { void load(); }, [load]);

  const tenantName = useCallback((id: string | null, slug?: string) => {
    if (!id) return "Sin negocio identificado";
    return data?.negocios[id]?.name ?? (slug ? `/${slug}` : "Negocio borrado");
  }, [data]);

  const filtered = Boolean(tenant || level || source || q);
  const chart = useMemo(
    () => (data?.serie ?? []).map((s) => ({ ...s, tick: seriesTick(s.label, data?.periodo ?? period) })),
    [data, period],
  );

  const errores = data?.resumen.errores ?? 0;
  const avisos = data?.resumen.avisos ?? 0;
  const ultimoError = data?.resumen.ultimoError ?? null;

  // El contenedor de la página (sa-page) lo pone page.tsx, que debajo muestra las alertas por correo.
  return (
    <>
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Errores</h1>
          <p className="sa-subtitle">Errores y avisos de las APIs, por negocio. Se guardan 90 días.</p>
        </div>
        <button type="button" onClick={() => void load()} aria-busy={loading} className="sa-btn sa-btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden />
          Actualizar
        </button>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="sa-seg" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-56">
          <select aria-label="Negocio" value={tenant} onChange={(e) => setTenant(e.target.value)} className="sa-input">
            <option value="">Todos los negocios</option>
            <option value="ninguno">Sin negocio identificado</option>
            {(data?.listaNegocios ?? []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[150px] sm:flex-none sm:w-44">
          <select aria-label="Nivel" value={level} onChange={(e) => setLevel(e.target.value)} className="sa-input">
            <option value="">Errores y avisos</option>
            <option value="error">Solo errores</option>
            <option value="aviso">Solo avisos</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px] sm:flex-none sm:w-48">
          <select aria-label="Origen" value={source} onChange={(e) => setSource(e.target.value)} className="sa-input">
            <option value="">Todos los orígenes</option>
            <option value="navegador">Navegador</option>
            <option value="servidor">Servidor</option>
            <option value="agente">Agente de impresión</option>
          </select>
        </div>
        <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[220px]">
          <input
            aria-label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar mensaje, API o pantalla..."
            className="sa-input"
          />
        </div>
        {filtered && (
          <button
            type="button"
            onClick={() => { setTenant(""); setLevel(""); setSource(""); setSearch(""); setQ(""); }}
            className="sa-btn sa-btn-sm sa-btn-ghost"
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="sa-alert sa-alert-danger" role="alert">
          <CircleAlert aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* Resumen en una sola franja: las líneas entre cifras son el fondo que asoma por la separación de 1 px. */}
      <section className="sa-card overflow-hidden" aria-label="Resumen del período">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--sa-line)]">
          <div className={STAT_CELL}>
            <dt className="sa-stat-label">Errores</dt>
            <dd className="sa-stat-value"><span className={errores > 0 ? "sa-danger-text" : undefined}>{errores.toLocaleString("es-CR")}</span></dd>
            <dd className="sa-help">Fallas del servidor, 5xx y sin conexión</dd>
          </div>
          <div className={STAT_CELL}>
            <dt className="sa-stat-label">Avisos</dt>
            <dd className="sa-stat-value"><span className={avisos > 0 ? "sa-warn-text" : undefined}>{avisos.toLocaleString("es-CR")}</span></dd>
            <dd className="sa-help">Mensajes 4xx que vio el usuario</dd>
          </div>
          <div className={STAT_CELL}>
            <dt className="sa-stat-label">Negocios afectados</dt>
            <dd className="sa-stat-value">{data?.resumen.negocios ?? 0}</dd>
          </div>
          <div className={STAT_CELL}>
            <dt className="sa-stat-label">Último error</dt>
            <dd className="sa-stat-value break-words">{ultimoError ? timeAgo(ultimoError.lastAt) : "—"}</dd>
            {ultimoError && (
              <dd className="sa-help truncate" title={ultimoError.message}>{ultimoError.message || ultimoError.route}</dd>
            )}
          </div>
        </dl>
      </section>

      {/* Serie */}
      <section className="sa-card" aria-labelledby="errores-serie-title">
        <div className="sa-card-head">
          <h2 id="errores-serie-title" className="sa-h2">{period === "24h" ? "Por hora" : "Por día"}</h2>
          <ul className="sa-help flex flex-wrap gap-x-4 gap-y-1" aria-label="Colores del gráfico">
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-2.5 h-2.5 rounded-[2px]" style={{ background: CHART.errores }} />
              Errores
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-2.5 h-2.5 rounded-[2px]" style={{ background: CHART.avisos }} />
              Avisos
            </li>
          </ul>
        </div>
        <div className="sa-card-pad">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="tick" tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: CHART.cursor }}
                  contentStyle={{ background: CHART.surface, border: `1px solid ${CHART.grid}`, borderRadius: 8, color: CHART.ink, fontSize: 12, boxShadow: "0 4px 12px rgba(16, 24, 40, 0.08)" }}
                  labelStyle={{ color: CHART.ink, fontWeight: 600 }}
                  itemStyle={{ color: CHART.ink }}
                  labelFormatter={(_, payload) => {
                    const label = payload?.[0]?.payload?.label as string | undefined;
                    if (!label) return "";
                    return period === "24h" ? `${label.slice(8, 10)}/${label.slice(5, 7)} ${seriesTick(label, "24h")}` : `${label.slice(8, 10)}/${label.slice(5, 7)}/${label.slice(0, 4)}`;
                  }}
                />
                <Bar dataKey="errores" name="Errores" stackId="n" fill={CHART.errores} />
                <Bar dataKey="avisos" name="Avisos" stackId="n" fill={CHART.avisos} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Vistas */}
      <section className="sa-card overflow-hidden" aria-label="Errores y avisos del período">
        <div className="sa-tabs px-5 pt-1" role="tablist" aria-label="Vistas">
          {TABS.map((t) => (
            <button
              key={t.value} type="button" role="tab" id={`errores-tab-${t.value}`}
              aria-selected={tab === t.value} aria-controls="errores-tabpanel" onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="errores-tabpanel" role="tabpanel" aria-labelledby={`errores-tab-${tab}`}>
          {loading && !data ? (
            <div className="sa-empty">Cargando...</div>
          ) : !data || (data.resumen.errores + data.resumen.avisos === 0) ? (
            <div className="sa-empty">{filtered ? "Nada con esos filtros en este período" : "Sin errores ni avisos en este período"}</div>
          ) : tab === "api" ? (
            <div className="sa-table-wrap">
              <table className="sa-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>API</th>
                    <th className="sa-right">Errores</th>
                    <th className="sa-right">Avisos</th>
                    <th className="sa-right">Negocios</th>
                    <th>Mensaje más común</th>
                    <th>Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porApi.map((a) => (
                    <tr
                      key={`${a._id.source}${a._id.method}${a._id.route}`}
                      className="sa-row-clickable"
                      onClick={() => { setSearch(a._id.route); setTab("ultimos"); }}
                      title="Ver los últimos eventos de esta API"
                    >
                      <td>
                        <button type="button" className={`${ROW_BUTTON} sa-mono`}>{a._id.method} {a._id.route || "—"}</button>
                        <span className="block sa-help">{SOURCE_LABEL[a._id.source]}</span>
                      </td>
                      <td className="sa-right"><Num value={a.errores} tone="error" /></td>
                      <td className="sa-right"><Num value={a.avisos} tone="aviso" /></td>
                      <td className="sa-right sa-num">{a.negocios}</td>
                      <td className="max-w-[280px] truncate" title={a.mensaje}>{a.mensaje || "—"}</td>
                      <td className="sa-num whitespace-nowrap"><span className="sa-muted">{fmtDateTime(a.ultimo)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === "negocio" ? (
            <div className="sa-table-wrap">
              <table className="sa-table min-w-[680px]">
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th className="sa-right">Errores</th>
                    <th className="sa-right">Avisos</th>
                    <th>API que más falla</th>
                    <th>Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porNegocio.map((t) => (
                    <tr
                      key={t._id ?? "ninguno"}
                      className="sa-row-clickable"
                      onClick={() => setTenant(t._id ?? "ninguno")}
                      title="Filtrar por este negocio"
                    >
                      <td>
                        <button type="button" className={`${ROW_BUTTON} font-medium`}>{tenantName(t._id, t.tenantSlug)}</button>
                      </td>
                      <td className="sa-right"><Num value={t.errores} tone="error" /></td>
                      <td className="sa-right"><Num value={t.avisos} tone="aviso" /></td>
                      <td className="sa-mono">{t.apiTop ? `${t.apiTop.method} ${t.apiTop.route}` : "—"}</td>
                      <td className="sa-num whitespace-nowrap"><span className="sa-muted">{fmtDateTime(t.ultimo)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === "mensajes" ? (
            <div className="sa-table-wrap">
              <table className="sa-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Mensaje</th>
                    <th>Nivel</th>
                    <th className="sa-right">Veces</th>
                    <th className="sa-right">Negocios</th>
                    <th>Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mensajes.map((m) => (
                    <tr key={`${m._id.level}${m._id.route}${m._id.message}`}>
                      <td className="max-w-[360px]">
                        <span className="block break-words">{m._id.message || "(sin mensaje)"}</span>
                        <span className="block truncate sa-mono sa-muted">{m._id.route}</span>
                      </td>
                      <td><LevelChip level={m._id.level} /></td>
                      <td className="sa-right sa-num font-semibold">{m.veces.toLocaleString("es-CR")}</td>
                      <td className="sa-right sa-num">{m.negocios}</td>
                      <td className="sa-num whitespace-nowrap"><span className="sa-muted">{fmtDateTime(m.ultimo)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sa-table-wrap">
              <table className="sa-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Cuándo</th>
                    <th>Negocio</th>
                    <th>Nivel</th>
                    <th>API</th>
                    <th>Mensaje</th>
                    <th className="sa-right">Veces</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ultimos.map((e) => (
                    <tr key={e._id} className="sa-row-clickable" onClick={() => setDetail(e)} title="Ver el detalle">
                      <td className="sa-num whitespace-nowrap"><span className="sa-muted">{fmtDateTime(e.lastAt)}</span></td>
                      <td className="whitespace-nowrap">{tenantName(e.tenantId, e.tenantSlug)}</td>
                      <td><LevelChip level={e.level} /></td>
                      <td className="sa-mono whitespace-nowrap">{e.method} {e.route}{e.status ? ` · ${e.status}` : ""}</td>
                      <td className="max-w-[320px] truncate" title={e.message}>
                        <button type="button" aria-haspopup="dialog" className={`${ROW_BUTTON} block w-full truncate`}>{e.message || KIND_LABEL[e.kind]}</button>
                      </td>
                      <td className="sa-right sa-num">{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {detail && <EventDetail event={detail} tenantName={tenantName(detail.tenantId, detail.tenantSlug)} onClose={() => setDetail(null)} />}
    </>
  );
}

// ── Detalle de un evento ───────────────────────────────────────────────────────

function EventDetail({ event, tenantName, onClose }: { event: EventRow; tenantName: string; onClose: () => void }) {
  // Solo cierra el clic que empieza y termina en el fondo: seleccionar el stack y soltar afuera no cuenta.
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Negocio", value: tenantName },
    { label: "Quién", value: event.userName ? `${event.userName}${event.userRole ? ` (${ROLE_LABEL[event.userRole] ?? event.userRole})` : ""}` : "—" },
    { label: "Pantalla", value: event.page || "—" },
    { label: "API", value: `${event.method} ${event.route}`.trim() || "—", mono: true },
    { label: "Estado", value: event.status ? String(event.status) : "—" },
    { label: "Tipo", value: `${KIND_LABEL[event.kind]} · ${SOURCE_LABEL[event.source]}` },
    { label: "Código", value: event.code || "—" },
    { label: "Veces en este tramo", value: String(event.count) },
    { label: "Primera / última vez", value: `${fmtDateTime(event.firstAt)} / ${fmtDateTime(event.lastAt)}` },
    { label: "Versión de la app", value: event.appVersion || "—" },
    { label: "Navegador", value: event.userAgent || "—" },
  ];

  return (
    <div
      className="sa-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="error-detail-title"
      onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (pressedBackdrop.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="sa-modal sa-modal-wide">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col items-start gap-2">
            <LevelChip level={event.level} />
            <h2 id="error-detail-title" className="sa-modal-title break-words">{event.message || KIND_LABEL[event.kind]}</h2>
          </div>
          <button type="button" onClick={onClose} autoFocus aria-label="Cerrar detalle" className="sa-icon-btn shrink-0">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <dl className="sa-divide">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-1 sm:grid-cols-[170px_minmax(0,1fr)] gap-x-4 gap-y-0.5 py-2">
              <dt className="sa-muted">{r.label}</dt>
              <dd className={`min-w-0 break-words ${r.mono ? "sa-mono" : ""}`}>{r.value}</dd>
            </div>
          ))}
        </dl>
        {event.stack && (
          <div className="flex flex-col gap-2 min-w-0">
            <p className="sa-eyebrow flex items-center gap-2"><AlertTriangle className="w-4 h-4" aria-hidden />Detalle técnico</p>
            <pre className="sa-inset sa-mono p-4 overflow-x-auto whitespace-pre leading-relaxed">{event.stack}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
