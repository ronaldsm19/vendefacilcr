"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, Plus, Trash2, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_SECTIONS, MAX_SECTION_NAME, type BusinessSection } from "@/lib/sections";

interface DraftSection {
  /** Id guardado; vacío mientras la sección es nueva y no se ha guardado. */
  id: string;
  name: string;
  /** Llave estable para React, también para las nuevas. */
  key: string;
}

let draftCounter = 0;
function toDraft(sections: BusinessSection[]): DraftSection[] {
  return sections.map((s) => ({ id: s.id, name: s.name, key: s.id }));
}

/**
 * Secciones del negocio (Configuración → Productos). Se editan como borrador y se guardan todas de
 * una vez: renombrar, reordenar, agregar o quitar. Quitar una sección deja sus categorías sin
 * sección (no borra productos ni categorías).
 */
export default function SectionsManager({
  sections,
  categoryCountBySection,
  onSaved,
}: {
  sections: BusinessSection[];
  /** Cuántas categorías tiene asignadas cada sección, para avisar antes de quitar una. */
  categoryCountBySection: Record<string, number>;
  onSaved: (sections: BusinessSection[]) => void;
}) {
  const [draft, setDraft] = useState<DraftSection[]>(() => toDraft(sections));
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft(toDraft(sections)); }, [sections]);

  const dirty =
    draft.length !== sections.length ||
    draft.some((d, i) => d.id !== sections[i]?.id || d.name.trim() !== sections[i]?.name);

  function addSection(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || draft.length >= MAX_SECTIONS) return;
    setDraft((prev) => [...prev, { id: "", name, key: `new-${++draftCounter}` }]);
    setNewName("");
    setSaved(false);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= draft.length) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: draft.map((d) => ({ id: d.id || undefined, name: d.name })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudieron guardar las secciones");
        return;
      }
      onSaved(data.sections ?? []);
      setSaved(true);
    } catch {
      setError("No se pudieron guardar las secciones — revisá tu conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-brand-dark text-lg">Secciones del negocio</h2>
        <p className="text-sm text-brand-dark/50 mt-0.5">
          Opcional. Si vendés líneas distintas (por ejemplo &quot;Cafetería&quot; y &quot;Tienda&quot;), creá una
          sección para cada una y asigná cada familia abajo. Tu tienda y el menú digital las muestran en
          pestañas separadas, la caja las puede filtrar, y finanzas y el cierre de caja dicen cuánto vendió
          cada una. Todo sigue siendo una sola caja. Sin secciones, todo se ve como siempre.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {draft.length > 0 && (
        <div className="space-y-2">
          {draft.map((d, index) => {
            const assigned = d.id ? categoryCountBySection[d.id] ?? 0 : 0;
            return (
              <div key={d.key} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-muted bg-brand-muted/10">
                <input
                  type="text"
                  value={d.name}
                  maxLength={MAX_SECTION_NAME}
                  aria-label="Nombre de la sección"
                  onChange={(e) => {
                    const name = e.target.value;
                    setDraft((prev) => prev.map((x) => (x.key === d.key ? { ...x, name } : x)));
                    setSaved(false);
                  }}
                  className="flex-1 min-w-0 bg-transparent text-sm text-brand-dark focus:outline-none border-b border-transparent focus:border-brand-pink"
                />
                <span className="text-xs text-brand-dark/40 shrink-0 hidden sm:inline">
                  {d.id ? `${assigned} ${assigned === 1 ? "familia" : "familias"}` : "nueva"}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/30 hover:text-brand-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Subir"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === draft.length - 1}
                    className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/30 hover:text-brand-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Bajar"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    title={assigned > 0 ? "Quitar sección (sus familias quedan sin sección)" : "Quitar sección"}
                    aria-label="Quitar sección"
                    onClick={() => { setDraft((prev) => prev.filter((x) => x.key !== d.key)); setSaved(false); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft.length < MAX_SECTIONS ? (
        <form onSubmit={addSection} className="flex gap-2">
          <input
            type="text"
            value={newName}
            maxLength={MAX_SECTION_NAME}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nueva sección (ej. Cafetería)"
            className="flex-1 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
          <Button type="submit" disabled={!newName.trim()} size="sm" aria-label="Agregar sección">
            <Plus className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        <p className="text-xs text-brand-dark/40">Llegaste al máximo de {MAX_SECTIONS} secciones.</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !dirty} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Guardar secciones
        </Button>
        {saved && !dirty && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <Check className="w-4 h-4" /> Guardado
          </span>
        )}
      </div>
    </section>
  );
}
