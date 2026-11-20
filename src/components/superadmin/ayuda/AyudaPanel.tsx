"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Link2Off, Pencil, Plus, Save, Trash2, X, type LucideIcon } from "lucide-react";
import {
  HELP_LIMITS, HELP_SECTIONS, helpSectionLabel, youtubeId, youtubeThumbUrl, youtubeWatchUrl, type HelpSection,
} from "@/lib/helpVideos";

interface VideoRow {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  section: HelpSection;
  order: number;
  visible: boolean;
}

type Filter = "todos" | "visibles" | "ocultos" | "sin-enlace";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "visibles", label: "Visibles" },
  { value: "ocultos", label: "Ocultos" },
  { value: "sin-enlace", label: "Sin enlace" },
];

const EMPTY = { title: "", url: "", section: "general" as HelpSection, order: "", description: "", visible: true };

function StateChip({ video }: { video: VideoRow }) {
  const [tone, Icon, label]: [string, LucideIcon, string] = !video.youtubeId
    ? ["sa-chip-warn", Link2Off, "Sin enlace"]
    : video.visible ? ["sa-chip-ok", Check, "Visible"] : ["", EyeOff, "Oculto"];
  return <span className={`sa-chip ${tone}`}><Icon aria-hidden />{label}</span>;
}

/** Videos de ayuda que ven los negocios en su panel: cargarlos, ordenarlos y decidir cuáles se muestran. */
export default function AyudaPanel() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [section, setSection] = useState<HelpSection | "">("");

  const load = useCallback(async () => {
    const res = await fetch("/api/superadmin/help-videos");
    if (!res.ok) return;
    const d = await res.json();
    setVideos(d.videos ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const urlId = form.url.trim() ? youtubeId(form.url) : null;
  const urlBad = form.url.trim() !== "" && !urlId;

  function edit(v: VideoRow) {
    setEditing(v.id);
    setForm({ title: v.title, url: v.youtubeId ? youtubeWatchUrl(v.youtubeId) : "", section: v.section, order: String(v.order), description: v.description, visible: v.visible });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancel() {
    setEditing(null);
    setForm(EMPTY);
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const body = { title: form.title, url: form.url, section: form.section, order: form.order === "" ? 0 : Number(form.order), description: form.description, visible: form.visible && !!urlId };
      const res = await fetch(editing ? `/api/superadmin/help-videos/${editing}` : "/api/superadmin/help-videos", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "No se pudo guardar" }); return; }
      setMsg({ ok: true, text: editing ? "Video actualizado" : "Video agregado" });
      setEditing(null);
      setForm({ ...EMPTY, section: form.section });
      void load();
    } catch {
      setMsg({ ok: false, text: "Error de red al guardar" });
    } finally {
      setSaving(false);
    }
  }

  async function setVisible(v: VideoRow, visible: boolean) {
    setActing(v.id);
    try {
      const res = await fetch(`/api/superadmin/help-videos/${v.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "No se pudo cambiar");
      }
      await load();
    } finally {
      setActing(null);
    }
  }

  async function remove(v: VideoRow) {
    if (!confirm(`¿Borrar "${v.title}"? Deja de verse en todos los negocios.`)) return;
    setActing(v.id);
    try {
      await fetch(`/api/superadmin/help-videos/${v.id}`, { method: "DELETE" });
      if (editing === v.id) cancel();
      await load();
    } finally {
      setActing(null);
    }
  }

  const shown = useMemo(() => (videos ?? []).filter((v) =>
    (!section || v.section === section)
    && (filter === "todos"
      || (filter === "visibles" && v.visible && v.youtubeId)
      || (filter === "ocultos" && !v.visible && v.youtubeId)
      || (filter === "sin-enlace" && !v.youtubeId))), [videos, filter, section]);

  const groups = useMemo(() => {
    const map = new Map<string, VideoRow[]>();
    for (const v of shown) map.set(v.section, [...(map.get(v.section) ?? []), v]);
    return [...map.entries()];
  }, [shown]);

  const counts = useMemo(() => {
    const all = videos ?? [];
    return { visibles: all.filter((v) => v.visible && v.youtubeId).length, total: all.length };
  }, [videos]);

  return (
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Videos de ayuda</h1>
          <p className="sa-subtitle">
            Los ven todos los negocios en su panel: en el botón Ayuda de cada pantalla y en la página de ayuda.
            Cada persona ve solo los de las secciones de su rol.
          </p>
        </div>
      </header>

      <section className="sa-card" aria-labelledby="form-video">
        <div className="sa-card-head">
          <h2 id="form-video" className="sa-h2">{editing ? "Editar video" : "Agregar video"}</h2>
        </div>
        <div className="sa-card-pad flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-4">
            <div className="flex flex-col gap-4 min-w-0">
              <label className="sa-field">
                <span className="sa-label">Título (la pregunta que responde)</span>
                <input value={form.title} maxLength={HELP_LIMITS.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="sa-input" placeholder="Cómo abrir la caja" />
              </label>
              <label className="sa-field">
                <span className="sa-label">Enlace de YouTube</span>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="sa-input" placeholder="https://youtu.be/..." inputMode="url" />
                {urlBad
                  ? <span className="sa-error">Ese enlace no es de un video de YouTube.</span>
                  : <span className="sa-help">Pegá el enlace de compartir del video. Si todavía no lo subiste, dejalo vacío: queda guardado sin mostrarse.</span>}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px] gap-4">
                <label className="sa-field">
                  <span className="sa-label">Dónde sale</span>
                  <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value as HelpSection })} className="sa-input">
                    {HELP_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </label>
                <label className="sa-field">
                  <span className="sa-label">Orden</span>
                  <input type="number" min={0} max={HELP_LIMITS.order} value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="sa-input" placeholder="0" />
                </label>
              </div>
              <label className="sa-field">
                <span className="sa-label flex justify-between gap-3">
                  <span>Descripción (opcional)</span>
                  <span className="sa-help sa-num font-normal">{form.description.length}/{HELP_LIMITS.description}</span>
                </span>
                <textarea rows={2} value={form.description} maxLength={HELP_LIMITS.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="sa-input resize-none" />
              </label>
              <label className="sa-check">
                <input type="checkbox" checked={form.visible && !!urlId} disabled={!urlId} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
                <span>
                  Mostrar en los negocios
                  {!urlId && <span className="block sa-help">Se puede mostrar cuando tenga el enlace.</span>}
                </span>
              </label>
            </div>
            <div className="hidden lg:block">
              {urlId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={youtubeThumbUrl(urlId)} alt="Vista previa del video" className="w-full aspect-video object-cover rounded-lg" />
              ) : (
                <div className="sa-inset w-full aspect-video flex items-center justify-center sa-muted text-sm">Vista previa</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving || form.title.trim().length < 3 || urlBad} className="sa-btn sa-btn-primary">
              {editing ? <Save className="w-4 h-4" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />}
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Agregar video"}
            </button>
            {editing && (
              <button type="button" onClick={cancel} className="sa-btn sa-btn-secondary">
                <X className="w-4 h-4" aria-hidden />
                Cancelar
              </button>
            )}
            {msg && <p role="status" className={msg.ok ? "sa-success" : "sa-error"}>{msg.text}</p>}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="lista-videos">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="lista-videos" className="sa-h2">Videos</h2>
            <p className="sa-help"><span className="sa-num">{counts.visibles}</span> visibles de <span className="sa-num">{counts.total}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="sa-input w-auto" aria-label="Filtrar por estado">
              {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={section} onChange={(e) => setSection(e.target.value as HelpSection | "")} className="sa-input w-auto" aria-label="Filtrar por sección">
              <option value="">Todas las secciones</option>
              {HELP_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {videos === null ? (
          <p className="sa-muted">Cargando...</p>
        ) : shown.length === 0 ? (
          <div className="sa-card sa-empty">{videos.length ? "Ningún video con ese filtro." : "Todavía no hay videos."}</div>
        ) : (
          groups.map(([key, list]) => (
            <div key={key} className="sa-card">
              <div className="sa-card-head">
                <h3 className="sa-h2">{helpSectionLabel(key)}</h3>
              </div>
              <ul className="sa-divide">
                {list.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {v.youtubeId ? (
                      <a href={youtubeWatchUrl(v.youtubeId)} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label={`Ver ${v.title} en YouTube`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={youtubeThumbUrl(v.youtubeId)} alt="" className="w-24 aspect-video object-cover rounded-md" />
                      </a>
                    ) : (
                      <div className="sa-inset w-24 aspect-video shrink-0" />
                    )}
                    <div className="flex-1 min-w-[12rem]">
                      <p className="sa-strong break-words">{v.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StateChip video={v} />
                        <span className="sa-help">Orden <span className="sa-num">{v.order}</span></span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {v.youtubeId && (
                        <button type="button" onClick={() => void setVisible(v, !v.visible)} disabled={acting === v.id} className="sa-btn sa-btn-sm sa-btn-secondary">
                          {v.visible ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                          {v.visible ? "Ocultar" : "Mostrar"}
                        </button>
                      )}
                      <button type="button" onClick={() => edit(v)} className="sa-btn sa-btn-sm sa-btn-secondary">
                        <Pencil className="w-4 h-4" aria-hidden />
                        Editar
                      </button>
                      <button type="button" onClick={() => void remove(v)} disabled={acting === v.id} className="sa-btn sa-btn-sm sa-btn-ghost-danger">
                        <Trash2 className="w-4 h-4" aria-hidden />
                        Borrar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
