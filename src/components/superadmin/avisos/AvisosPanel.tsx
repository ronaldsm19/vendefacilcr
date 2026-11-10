"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Banknote, Check, Clock, Info, Pause, Play, Send, Trash2, type LucideIcon } from "lucide-react";
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

type NoticeState = "Activo" | "Pausado" | "Vencido";

const KIND_CHIP: Record<NoticeKind, { tone: string; Icon: LucideIcon }> = {
  info: { tone: "sa-chip-info", Icon: Info },
  cobro: { tone: "sa-chip-warn", Icon: Banknote },
  urgente: { tone: "sa-chip-danger", Icon: AlertTriangle },
};
const STATE_CHIP: Record<NoticeState, { tone: string; Icon: LucideIcon }> = {
  Activo: { tone: "sa-chip-ok", Icon: Check },
  Pausado: { tone: "", Icon: Pause },
  Vencido: { tone: "", Icon: Clock },
};
const ROLE_LABELS: Record<string, string> = { admin: "Dueño", cajero: "Cajero", mesero: "Mesero" };
const when = (iso: string) => new Date(iso).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" });

function KindChip({ kind }: { kind: NoticeKind }) {
  const { tone, Icon } = KIND_CHIP[kind];
  return <span className={`sa-chip ${tone}`}><Icon aria-hidden />{noticeKindLabel(kind)}</span>;
}

function StateChip({ state }: { state: NoticeState }) {
  const { tone, Icon } = STATE_CHIP[state];
  return <span className={`sa-chip ${tone}`}><Icon aria-hidden />{state}</span>;
}

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
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Avisos</h1>
          <p className="sa-subtitle">
            Mensajes que los negocios ven dentro de su panel. El aviso de mensualidad por vencer sale solo, con el cobro automático.
          </p>
        </div>
      </header>

      {/* Nuevo aviso */}
      <section className="sa-card" aria-labelledby="nuevo-aviso">
        <div className="sa-card-head">
          <h2 id="nuevo-aviso" className="sa-h2">Nuevo aviso</h2>
        </div>

        <div className="sa-card-pad flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-3">
              <label className="sa-field">
                <span className="sa-label">Tipo</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as NoticeKind)} className="sa-input">
                  {NOTICE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </label>
              <label className="sa-field">
                <span className="sa-label">Título</span>
                <input value={title} maxLength={NOTICE_LIMITS.title} onChange={(e) => setTitle(e.target.value)} className="sa-input" placeholder="Mantenimiento el domingo" />
              </label>
            </div>
            {kindInfo && <p className="sa-help">{kindInfo.hint}</p>}
          </div>

          <label className="sa-field">
            <span className="sa-label flex justify-between gap-3">
              <span>Mensaje</span>
              <span className="sa-help sa-num font-normal">{body.length}/{NOTICE_LIMITS.body}</span>
            </span>
            <textarea rows={4} value={body} maxLength={NOTICE_LIMITS.body} onChange={(e) => setBody(e.target.value)} className="sa-input resize-none" />
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <fieldset className="min-w-0">
              <legend className="sa-label">Para quién</legend>
              <div className="mt-2 flex flex-col gap-2">
                <label className="sa-check">
                  <input type="radio" name="audience" checked={audience === "all"} onChange={() => setAudience("all")} />
                  <span>Todos los negocios</span>
                </label>
                <label className="sa-check">
                  <input type="radio" name="audience" checked={audience === "tenants"} onChange={() => setAudience("tenants")} />
                  <span>Elegir negocios</span>
                </label>
                {audience === "tenants" && (
                  <div className="sa-inset max-h-44 overflow-y-auto p-3 flex flex-col gap-2">
                    {tenants.map((t) => (
                      <label key={t.id} className="sa-check">
                        <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                        <span>
                          {t.name}
                          {t.status !== "active" && <span className="sa-danger-text text-xs"> (suspendido: no puede entrar a verlo)</span>}
                        </span>
                      </label>
                    ))}
                    {!tenants.length && <p className="sa-muted">Cargando negocios...</p>}
                  </div>
                )}
              </div>
            </fieldset>

            <div className="flex flex-col gap-3">
              <label className="sa-field">
                <span className="sa-label">Quién lo ve dentro del negocio</span>
                <select
                  value={kind === "cobro" ? "owner" : roles} disabled={kind === "cobro"}
                  onChange={(e) => setRoles(e.target.value as NoticeRoles)} className="sa-input"
                >
                  <option value="owner">Solo el dueño</option>
                  <option value="all">Dueño y personal (cajeros, meseros)</option>
                </select>
              </label>
              <label className="sa-field">
                <span className="sa-label">Deja de mostrarse después del (opcional)</span>
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="sa-input" />
              </label>
              <label className="sa-check">
                <input type="checkbox" checked={everyLogin} onChange={(e) => setEveryLogin(e.target.checked)} />
                <span>
                  Mostrar en cada inicio de sesión
                  <span className="block sa-help">Si no, cada persona lo ve una sola vez.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button" onClick={() => void send()}
              disabled={sending || title.trim().length < 3 || !body.trim() || (audience === "tenants" && !selected.length)}
              className="sa-btn sa-btn-primary"
            >
              <Send className="w-4 h-4" aria-hidden />
              {sending ? "Enviando..." : "Enviar aviso"}
            </button>
            {msg && <p role="status" className={msg.ok ? "sa-success" : "sa-error"}>{msg.text}</p>}
          </div>
        </div>
      </section>

      {/* Enviados */}
      <section className="flex flex-col gap-3" aria-labelledby="avisos-enviados">
        <h2 id="avisos-enviados" className="sa-h2">Enviados</h2>
        {notices === null ? (
          <p className="sa-muted">Cargando...</p>
        ) : notices.length === 0 ? (
          <div className="sa-card sa-empty">Todavía no hay avisos.</div>
        ) : (
          notices.map((n) => {
            const state: NoticeState = !n.active ? "Pausado" : n.expired ? "Vencido" : "Activo";
            return (
              <article key={n.id} className="sa-card sa-card-pad flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <KindChip kind={n.kind} />
                      <StateChip state={state} />
                    </div>
                    <h3 className="sa-strong text-base break-words">{n.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button" onClick={() => void act(n.id, n.active ? "pause" : "resume")} disabled={acting === n.id}
                      className="sa-btn sa-btn-sm sa-btn-secondary"
                    >
                      {n.active ? <Pause className="w-4 h-4" aria-hidden /> : <Play className="w-4 h-4" aria-hidden />}
                      {n.active ? "Pausar" : "Reanudar"}
                    </button>
                    <button
                      type="button" onClick={() => void act(n.id, "delete")} disabled={acting === n.id}
                      className="sa-btn sa-btn-sm sa-btn-ghost-danger"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                      Borrar
                    </button>
                  </div>
                </div>

                <p className="whitespace-pre-line break-words text-[var(--sa-ink-3)]">{n.body}</p>

                <p className="sa-help">
                  Para {n.audience === "all" ? "todos los negocios" : n.tenantNames.join(", ")}
                  {" · "}{n.roles === "all" ? "dueño y personal" : "solo el dueño"}
                  {n.showEveryLogin && " · en cada inicio de sesión"}
                  {n.expiresAt && ` · hasta el ${formatCrDate(new Date(new Date(n.expiresAt).getTime() - 1))}`}
                  {" · "}enviado el {when(n.createdAt)}
                </p>

                <details>
                  <summary className="cursor-pointer">
                    Visto por <strong className="sa-strong sa-num">{n.seenTenants}</strong> de <span className="sa-num">{n.recipients}</span> negocio(s)
                  </summary>
                  {n.reads.length === 0 ? (
                    <p className="sa-muted mt-2">Nadie lo ha visto todavía.</p>
                  ) : (
                    <ul className="sa-inset sa-divide mt-2 px-3">
                      {n.reads.map((r, i) => (
                        <li key={i} className="flex flex-wrap gap-x-3 py-2">
                          <span className="sa-strong">{r.tenantName}</span>
                          <span>{r.userName} ({ROLE_LABELS[r.role] ?? r.role})</span>
                          <span className="sa-muted">{when(r.firstSeenAt)}{r.count > 1 && ` · ${r.count} veces, la última ${when(r.lastSeenAt)}`}</span>
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
