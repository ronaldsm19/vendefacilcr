"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Pause, Play, Trash2 } from "lucide-react";
import { NOTICE_KINDS, NOTICE_LIMITS, noticeKindLabel, type NoticeKind, type NoticeRoles } from "@/lib/notices";
import { formatCrDate } from "@/lib/billing";

interface TenantOption { id: string; name: string; status: string }
interface Read { tenantName: string; userName: string; role: string; firstSeenAt: string; lastSeenAt: string; count: number }
interface NoticeRow {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  audience: "all" | "tenants";
  tenantNames: string[];
  roles: NoticeRoles;
  showEveryLogin: boolean;
  expiresAt: string | null;
  active: boolean;
  expired: boolean;
  createdBy: string;
  createdAt: string;
  recipients: number;
  seenTenants: number;
  reads: Read[];
}

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" };
const KIND_CHIP: Record<NoticeKind, string> = {
  info: "bg-sky-500/20 text-sky-300",
  cobro: "bg-amber-500/20 text-amber-300",
  urgente: "bg-red-500/20 text-red-300",
};
const ROLE_LABELS: Record<string, string> = { admin: "Dueño", cajero: "Cajero", mesero: "Mesero" };
const when = (iso: string) => new Date(iso).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" });

/** Avisos del superadmin a los negocios: crear uno y ver quién lo vio. */
export default function AvisosPanel() {
  const preselected = useSearchParams().get("negocio");
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [notices, setNotices] = useState<NoticeRow[] | null>(null);

  const [kind, setKind] = useState<NoticeKind>("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "tenants">(preselected ? "tenants" : "all");
  const [selected, setSelected] = useState<string[]>(preselected ? [preselected] : []);
  const [roles, setRoles] = useState<NoticeRoles>("owner");
  const [everyLogin, setEveryLogin] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/superadmin/avisos");
    if (!res.ok) return;
    const d = await res.json();
    setTenants(d.tenants ?? []);
    setNotices(d.notices ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const kindInfo = NOTICE_KINDS.find((k) => k.value === kind);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function send() {
    const who = audience === "all" ? "todos los negocios activos" : `${selected.length} negocio(s)`;
    if (!confirm(`¿Enviar este aviso a ${who}? Lo ven dentro de su panel.`)) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/superadmin/avisos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, body, audience, tenantIds: selected, roles, showEveryLogin: everyLogin, expiresAt }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "No se pudo enviar" }); return; }
      setMsg({ ok: true, text: "Aviso enviado" });
      setTitle(""); setBody(""); setEveryLogin(false); setExpiresAt("");
      void load();
    } catch {
      setMsg({ ok: false, text: "Error de red al enviar" });
    } finally {
      setSending(false);
    }
  }

  async function act(id: string, action: "pause" | "resume" | "delete") {
    if (action === "delete" && !confirm("¿Borrar este aviso? También se borra el registro de quién lo vio.")) return;
    setActing(id);
    try {
      await fetch(`/api/superadmin/avisos/${id}`, action === "delete"
        ? { method: "DELETE" }
        : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: action === "resume" }) });
      await load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Avisos</h1>
        <p className="text-white/40 text-sm mt-1">
          Mensajes que los negocios ven dentro de su panel. El aviso de mensualidad por vencer sale solo, con el cobro automático.
        </p>
      </div>

      {/* Nuevo aviso */}
      <section className="rounded-2xl p-6 space-y-4" style={CARD} aria-labelledby="nuevo-aviso">
        <h2 id="nuevo-aviso" className="text-white/70 font-semibold text-sm uppercase tracking-wide">Nuevo aviso</h2>

        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-white/50">Tipo</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as NoticeKind)} className="saas-input cursor-pointer">
              {NOTICE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-white/50">Título</span>
            <input value={title} maxLength={NOTICE_LIMITS.title} onChange={(e) => setTitle(e.target.value)} className="saas-input" placeholder="Mantenimiento el domingo" />
          </label>
        </div>
        {kindInfo && <p className="text-xs text-white/35">{kindInfo.hint}</p>}

        <label className="block space-y-1.5">
          <span className="flex justify-between text-xs text-white/50">
            <span>Mensaje</span>
            <span className="tabular-nums">{body.length}/{NOTICE_LIMITS.body}</span>
          </span>
          <textarea rows={4} value={body} maxLength={NOTICE_LIMITS.body} onChange={(e) => setBody(e.target.value)} className="saas-input resize-none" />
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <fieldset className="space-y-2">
            <legend className="text-xs text-white/50 mb-1">Para quién</legend>
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input type="radio" name="audience" checked={audience === "all"} onChange={() => setAudience("all")} className="accent-purple-500" />
              Todos los negocios
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input type="radio" name="audience" checked={audience === "tenants"} onChange={() => setAudience("tenants")} className="accent-purple-500" />
              Elegir negocios
            </label>
            {audience === "tenants" && (
              <div className="max-h-44 overflow-y-auto rounded-xl p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                {tenants.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm text-white/75 cursor-pointer">
                    <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="w-4 h-4 accent-purple-500" />
                    {t.name}
                    {t.status !== "active" && <span className="text-xs text-red-300/80">(suspendido: no puede entrar a verlo)</span>}
                  </label>
                ))}
                {!tenants.length && <p className="text-sm text-white/30">Cargando negocios...</p>}
              </div>
            )}
          </fieldset>

          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-white/50">Quién lo ve dentro del negocio</span>
              <select
                value={kind === "cobro" ? "owner" : roles} disabled={kind === "cobro"}
                onChange={(e) => setRoles(e.target.value as NoticeRoles)} className="saas-input cursor-pointer disabled:opacity-60"
              >
                <option value="owner">Solo el dueño</option>
                <option value="all">Dueño y personal (cajeros, meseros)</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-white/50">Deja de mostrarse después del (opcional)</span>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="saas-input" />
            </label>
            <label className="flex items-start gap-2 text-sm text-white/80 cursor-pointer">
              <input type="checkbox" checked={everyLogin} onChange={(e) => setEveryLogin(e.target.checked)} className="w-4 h-4 mt-0.5 accent-purple-500" />
              <span>
                Mostrar en cada inicio de sesión
                <span className="block text-xs text-white/35">Si no, cada persona lo ve una sola vez.</span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" onClick={() => void send()}
            disabled={sending || title.trim().length < 3 || !body.trim() || (audience === "tenants" && !selected.length)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl saas-accent-bg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <Send className="w-4 h-4" aria-hidden /> {sending ? "Enviando..." : "Enviar aviso"}
          </button>
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        </div>
      </section>

      {/* Enviados */}
      <section className="space-y-3" aria-labelledby="avisos-enviados">
        <h2 id="avisos-enviados" className="text-white/70 font-semibold text-sm uppercase tracking-wide">Enviados</h2>
        {notices === null ? (
          <p className="text-sm text-white/30">Cargando...</p>
        ) : notices.length === 0 ? (
          <p className="text-sm text-white/30">Todavía no hay avisos.</p>
        ) : (
          notices.map((n) => {
            const state = !n.active ? "Pausado" : n.expired ? "Vencido" : "Activo";
            return (
              <article key={n.id} className="rounded-2xl p-5 space-y-3" style={CARD}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${KIND_CHIP[n.kind]}`}>{noticeKindLabel(n.kind)}</span>
                      <span className={`text-xs ${state === "Activo" ? "text-emerald-300" : "text-white/40"}`}>{state}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-white">{n.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button" onClick={() => void act(n.id, n.active ? "pause" : "resume")} disabled={acting === n.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white disabled:opacity-40 cursor-pointer"
                      style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      {n.active ? <Pause className="w-3.5 h-3.5" aria-hidden /> : <Play className="w-3.5 h-3.5" aria-hidden />}
                      {n.active ? "Pausar" : "Reanudar"}
                    </button>
                    <button
                      type="button" onClick={() => void act(n.id, "delete")} disabled={acting === n.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-300 hover:text-red-200 disabled:opacity-40 cursor-pointer"
                      style={{ border: "1px solid rgba(239,68,68,0.25)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden /> Borrar
                    </button>
                  </div>
                </div>

                <p className="text-sm text-white/65 whitespace-pre-line">{n.body}</p>

                <p className="text-xs text-white/40">
                  Para {n.audience === "all" ? "todos los negocios" : n.tenantNames.join(", ")}
                  {" · "}{n.roles === "all" ? "dueño y personal" : "solo el dueño"}
                  {n.showEveryLogin && " · en cada inicio de sesión"}
                  {n.expiresAt && ` · hasta el ${formatCrDate(new Date(new Date(n.expiresAt).getTime() - 1))}`}
                  {" · "}enviado el {when(n.createdAt)}
                </p>

                <details className="text-sm">
                  <summary className="cursor-pointer text-white/70">
                    Visto por <strong className="text-white">{n.seenTenants}</strong> de {n.recipients} negocio(s)
                  </summary>
                  {n.reads.length === 0 ? (
                    <p className="mt-2 text-white/35">Nadie lo ha visto todavía.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {n.reads.map((r, i) => (
                        <li key={i} className="flex flex-wrap gap-x-3 text-white/60">
                          <span className="text-white/85">{r.tenantName}</span>
                          <span>{r.userName} ({ROLE_LABELS[r.role] ?? r.role})</span>
                          <span className="text-white/40">{when(r.firstSeenAt)}{r.count > 1 && ` · ${r.count} veces, la última ${when(r.lastSeenAt)}`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
