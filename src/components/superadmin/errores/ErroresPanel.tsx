"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Bug, RefreshCw, Search, Building2, X } from "lucide-react";
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

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" };
const FIELD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };

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
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${level === "error" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}>
      {level === "error" ? "Error" : "Aviso"}
    </span>
  );
}

function Num({ value, tone }: { value: number; tone: "error" | "aviso" }) {
  if (!value) return <span className="text-white/25 tabular-nums">0</span>;
  return <span className={`font-semibold tabular-nums ${tone === "error" ? "text-red-300" : "text-amber-300"}`}>{value.toLocaleString("es-CR")}</span>;
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

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Errores</h1>
          <p className="text-white/40 text-sm mt-1">Errores y avisos de las APIs, por negocio. Se guardan 90 días.</p>
        </div>
        <button
          type="button" onClick={() => void load()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
          style={FIELD}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-xl p-0.5" style={FIELD} role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.value} type="button" onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${period === p.value ? "saas-accent-bg text-white" : "text-white/50 hover:text-white"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Negocio" value={tenant} onChange={(e) => setTenant(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer max-w-[220px]" style={{ ...FIELD, colorScheme: "dark" }}
        >
          <option value="">Todos los negocios</option>
          <option value="ninguno">Sin negocio identificado</option>
          {(data?.listaNegocios ?? []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <select
          aria-label="Nivel" value={level} onChange={(e) => setLevel(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer" style={{ ...FIELD, colorScheme: "dark" }}
        >
          <option value="">Errores y avisos</option>
          <option value="error">Solo errores</option>
          <option value="aviso">Solo avisos</option>
        </select>
        <select
          aria-label="Origen" value={source} onChange={(e) => setSource(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none cursor-pointer" style={{ ...FIELD, colorScheme: "dark" }}
        >
          <option value="">Todos los orígenes</option>
          <option value="navegador">Navegador</option>
          <option value="servidor">Servidor</option>
          <option value="agente">Agente de impresión</option>
        </select>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[180px]" style={FIELD}>
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            aria-label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar mensaje, API o pantalla..."
            className="bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none flex-1 min-w-0"
          />
        </div>
        {filtered && (
          <button
            type="button"
            onClick={() => { setTenant(""); setLevel(""); setSource(""); setSearch(""); setQ(""); }}
            className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer px-2"
          >
            Limpiar
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-300 rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>}

      {/* Resumen */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5" style={CARD}>
          <p className="text-2xl font-bold text-red-300 tabular-nums">{(data?.resumen.errores ?? 0).toLocaleString("es-CR")}</p>
          <p className="text-white/60 text-sm mt-1 font-medium">Errores</p>
          <p className="text-white/30 text-xs mt-0.5">Fallas del servidor, 5xx y sin conexión</p>
        </div>
        <div className="rounded-2xl p-5" style={CARD}>
          <p className="text-2xl font-bold text-amber-300 tabular-nums">{(data?.resumen.avisos ?? 0).toLocaleString("es-CR")}</p>
          <p className="text-white/60 text-sm mt-1 font-medium">Avisos</p>
          <p className="text-white/30 text-xs mt-0.5">Mensajes 4xx que vio el usuario</p>
        </div>
        <div className="rounded-2xl p-5" style={CARD}>
          <p className="text-2xl font-bold text-white tabular-nums">{data?.resumen.negocios ?? 0}</p>
          <p className="text-white/60 text-sm mt-1 font-medium">Negocios afectados</p>
        </div>
        <div className="rounded-2xl p-5 min-w-0" style={CARD}>
          <p className="text-2xl font-bold text-white">{data?.resumen.ultimoError ? timeAgo(data.resumen.ultimoError.lastAt) : "—"}</p>
          <p className="text-white/60 text-sm mt-1 font-medium">Último error</p>
          {data?.resumen.ultimoError && (
            <p className="text-white/30 text-xs mt-0.5 truncate" title={data.resumen.ultimoError.message}>{data.resumen.ultimoError.message || data.resumen.ultimoError.route}</p>
          )}
        </div>
      </div>

      {/* Serie */}
      <div className="rounded-2xl p-5" style={CARD}>
        <p className="text-white/70 text-sm font-semibold mb-4">{period === "24h" ? "Por hora" : "Por día"}</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="tick" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#12121A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 12 }}
                labelFormatter={(_, payload) => {
                  const label = payload?.[0]?.payload?.label as string | undefined;
                  if (!label) return "";
                  return period === "24h" ? `${label.slice(8, 10)}/${label.slice(5, 7)} ${seriesTick(label, "24h")}` : `${label.slice(8, 10)}/${label.slice(5, 7)}/${label.slice(0, 4)}`;
                }}
              />
              <Bar dataKey="errores" name="Errores" stackId="n" fill="#f87171" />
              <Bar dataKey="avisos" name="Avisos" stackId="n" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vistas */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Vistas">
          {TABS.map((t) => (
            <button
              key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${tab === t.value ? "bg-white/10 text-white" : "text-white/45 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {loading && !data ? (
            <div className="px-5 py-10 text-center text-white/30 text-sm">Cargando...</div>
          ) : !data || (data.resumen.errores + data.resumen.avisos === 0) ? (
            <div className="px-5 py-12 flex flex-col items-center gap-3">
              <Bug className="w-8 h-8 text-white/20" />
              <p className="text-white/30 text-sm">{filtered ? "Nada con esos filtros en este período" : "Sin errores ni avisos en este período"}</p>
            </div>
          ) : tab === "api" ? (
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-white/30" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th className="text-left px-5 py-3">API</th>
                  <th className="text-right px-3 py-3">Errores</th>
                  <th className="text-right px-3 py-3">Avisos</th>
                  <th className="text-right px-3 py-3">Negocios</th>
                  <th className="text-left px-3 py-3">Mensaje más común</th>
                  <th className="text-left px-5 py-3">Última vez</th>
                </tr>
              </thead>
              <tbody>
                {data.porApi.map((a) => (
                  <tr
                    key={`${a._id.source}${a._id.method}${a._id.route}`}
                    className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer"
                    onClick={() => { setSearch(a._id.route); setTab("ultimos"); }}
                    title="Ver los últimos eventos de esta API"
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-white/80">{a._id.method} {a._id.route || "—"}</span>
                      <span className="block text-[11px] text-white/35">{SOURCE_LABEL[a._id.source]}</span>
                    </td>
                    <td className="text-right px-3 py-3"><Num value={a.errores} tone="error" /></td>
                    <td className="text-right px-3 py-3"><Num value={a.avisos} tone="aviso" /></td>
                    <td className="text-right px-3 py-3 text-white/60 tabular-nums">{a.negocios}</td>
                    <td className="px-3 py-3 text-white/55 max-w-[280px] truncate" title={a.mensaje}>{a.mensaje || "—"}</td>
                    <td className="px-5 py-3 text-white/40 text-xs whitespace-nowrap">{fmtDateTime(a.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === "negocio" ? (
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-white/30" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th className="text-left px-5 py-3">Negocio</th>
                  <th className="text-right px-3 py-3">Errores</th>
                  <th className="text-right px-3 py-3">Avisos</th>
                  <th className="text-left px-3 py-3">API que más falla</th>
                  <th className="text-left px-5 py-3">Última vez</th>
                </tr>
              </thead>
              <tbody>
                {data.porNegocio.map((t) => (
                  <tr
                    key={t._id ?? "ninguno"}
                    className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer"
                    onClick={() => setTenant(t._id ?? "ninguno")}
                    title="Filtrar por este negocio"
                  >
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 text-white/80">
                        <Building2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        {tenantName(t._id, t.tenantSlug)}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3"><Num value={t.errores} tone="error" /></td>
                    <td className="text-right px-3 py-3"><Num value={t.avisos} tone="aviso" /></td>
                    <td className="px-3 py-3 font-mono text-xs text-white/55">{t.apiTop ? `${t.apiTop.method} ${t.apiTop.route}` : "—"}</td>
                    <td className="px-5 py-3 text-white/40 text-xs whitespace-nowrap">{fmtDateTime(t.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === "mensajes" ? (
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-white/30" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th className="text-left px-5 py-3">Mensaje</th>
                  <th className="text-left px-3 py-3">Nivel</th>
                  <th className="text-right px-3 py-3">Veces</th>
                  <th className="text-right px-3 py-3">Negocios</th>
                  <th className="text-left px-5 py-3">Última vez</th>
                </tr>
              </thead>
              <tbody>
                {data.mensajes.map((m) => (
                  <tr key={`${m._id.level}${m._id.route}${m._id.message}`} className="border-t border-white/5">
                    <td className="px-5 py-3 max-w-[360px]">
                      <span className="text-white/80">{m._id.message || "(sin mensaje)"}</span>
                      <span className="block font-mono text-[11px] text-white/35 truncate">{m._id.route}</span>
                    </td>
                    <td className="px-3 py-3"><LevelChip level={m._id.level} /></td>
                    <td className="text-right px-3 py-3 text-white/70 tabular-nums font-semibold">{m.veces.toLocaleString("es-CR")}</td>
                    <td className="text-right px-3 py-3 text-white/60 tabular-nums">{m.negocios}</td>
                    <td className="px-5 py-3 text-white/40 text-xs whitespace-nowrap">{fmtDateTime(m.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-white/30" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th className="text-left px-5 py-3">Cuándo</th>
                  <th className="text-left px-3 py-3">Negocio</th>
                  <th className="text-left px-3 py-3">Nivel</th>
                  <th className="text-left px-3 py-3">API</th>
                  <th className="text-left px-3 py-3">Mensaje</th>
                  <th className="text-right px-5 py-3">Veces</th>
                </tr>
              </thead>
              <tbody>
                {data.ultimos.map((e) => (
                  <tr
                    key={e._id} className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer"
                    onClick={() => setDetail(e)} title="Ver el detalle"
                  >
                    <td className="px-5 py-3 text-white/45 text-xs whitespace-nowrap">{fmtDateTime(e.lastAt)}</td>
                    <td className="px-3 py-3 text-white/70 whitespace-nowrap">{tenantName(e.tenantId, e.tenantSlug)}</td>
                    <td className="px-3 py-3"><LevelChip level={e.level} /></td>
                    <td className="px-3 py-3 font-mono text-xs text-white/60 whitespace-nowrap">{e.method} {e.route}{e.status ? ` · ${e.status}` : ""}</td>
                    <td className="px-3 py-3 text-white/70 max-w-[320px] truncate" title={e.message}>{e.message || KIND_LABEL[e.kind]}</td>
                    <td className="text-right px-5 py-3 text-white/60 tabular-nums">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detail && <EventDetail event={detail} tenantName={tenantName(detail.tenantId, detail.tenantSlug)} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ── Detalle de un evento ───────────────────────────────────────────────────────

function EventDetail({ event, tenantName, onClose }: { event: EventRow; tenantName: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: { label: string; value: string }[] = [
    { label: "Negocio", value: tenantName },
    { label: "Quién", value: event.userName ? `${event.userName}${event.userRole ? ` (${ROLE_LABEL[event.userRole] ?? event.userRole})` : ""}` : "—" },
    { label: "Pantalla", value: event.page || "—" },
    { label: "API", value: `${event.method} ${event.route}`.trim() || "—" },
    { label: "Estado", value: event.status ? String(event.status) : "—" },
    { label: "Tipo", value: `${KIND_LABEL[event.kind]} · ${SOURCE_LABEL[event.source]}` },
    { label: "Código", value: event.code || "—" },
    { label: "Veces en este tramo", value: String(event.count) },
    { label: "Primera / última vez", value: `${fmtDateTime(event.firstAt)} / ${fmtDateTime(event.lastAt)}` },
    { label: "Versión de la app", value: event.appVersion || "—" },
    { label: "Navegador", value: event.userAgent || "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="error-detail-title">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/70 cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5" style={{ background: "#0E0E15", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <LevelChip level={event.level} />
            <h2 id="error-detail-title" className="text-white text-lg font-semibold break-words">{event.message || KIND_LABEL[event.kind]}</h2>
          </div>
          <button
            type="button" onClick={onClose} autoFocus aria-label="Cerrar detalle"
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-white/40">{r.label}</dt>
              <dd className="text-white/80 break-words font-mono text-xs sm:text-sm sm:font-sans">{r.value}</dd>
            </div>
          ))}
        </dl>
        {event.stack && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-white/50 text-sm"><AlertTriangle className="w-4 h-4" /> Detalle técnico</p>
            <pre className="text-[11px] leading-relaxed text-white/60 rounded-xl p-4 overflow-x-auto whitespace-pre" style={{ background: "rgba(255,255,255,0.04)" }}>{event.stack}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
