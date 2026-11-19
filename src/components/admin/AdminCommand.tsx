"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, type LucideIcon } from "lucide-react";
import { PLAN_LABELS, type PlanKey } from "@/lib/billing";
import { hrefFor, locationOf, NAV_ACTIONS, type VisibleNav } from "@/lib/adminNav";

interface Hit {
  key: string;
  label: string;
  detail: string;
  kind: "Acción" | "Sección";
  icon: LucideIcon;
  href: string;
  lockedPlan: PlanKey | null;
}

const MAX_HITS = 8;

/** Sin tildes ni mayúsculas: "configuracion" encuentra "Configuración". */
function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Buscador del panel (Ctrl+K o "Buscar o ir a…"). Encuentra una sección por su nombre o por lo que
 * uno quiere hacer ("logo", "abrir caja", "mesero") y dice dónde vive, para que la próxima vez se
 * llegue por el menú. Solo muestra lo que esta persona puede abrir; lo que su plan no incluye sale con
 * el plan que lo trae.
 */
export default function AdminCommand({
  open,
  onClose,
  nav,
  base,
}: {
  open: boolean;
  onClose: () => void;
  nav: VisibleNav;
  base: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const words = norm(query.trim()).split(/\s+/).filter(Boolean);
  const matches = (text: string) => { const t = norm(text); return words.every((w) => t.includes(w)); };
  const bySegment = new Map(nav.all.map((i) => [i.segment, i]));
  const actionHits: Hit[] = NAV_ACTIONS.flatMap((a) => {
    const item = bySegment.get(a.segment);
    if (!item) return [];
    // Sin nada escrito, lo más buscado de lo que puede usar; escribiendo, también lo de otro plan.
    if (words.length === 0 ? item.lockedPlan : !matches(`${a.label} ${a.keywords}`)) return [];
    return [{
      key: `a:${a.label}`, label: a.label, kind: "Acción" as const, icon: a.icon,
      detail: locationOf(item, nav.flat, a.tabLabel).join(" › "),
      href: hrefFor(base, a.segment, a.tab), lockedPlan: item.lockedPlan,
    }];
  });
  const sectionHits: Hit[] = words.length === 0 ? [] : nav.all
    .filter((i) => matches(`${i.label} ${i.desc} ${i.groupLabel ?? ""}`))
    .map((i) => ({
      key: `s:${i.segment}`, label: i.label, kind: "Sección" as const, icon: i.icon,
      detail: i.desc, href: i.href, lockedPlan: i.lockedPlan,
    }));
  const hits = [...actionHits, ...sectionHits].slice(0, MAX_HITS);

  const close = () => { setQuery(""); setActive(0); onClose(); };
  const go = (href: string) => { close(); router.push(href); };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active].href); }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-dark/50 px-4 pt-[10vh] pb-4"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar en el panel"
      onClick={close}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 h-12 px-3.5 rounded-xl border border-brand-dark/15 focus-within:border-brand-dark/40">
          <Search className="w-[18px] h-[18px] shrink-0 text-brand-dark/50" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="¿Qué querés hacer? Probá con logo, caja o mesero"
            aria-label="Buscar en el panel"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-command-results"
            aria-activedescendant={hits[active] ? `admin-command-${active}` : undefined}
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-brand-dark placeholder:text-brand-dark/45 outline-none"
          />
          <kbd className="shrink-0 inline-flex items-center h-6 px-2 rounded-md border border-brand-dark/10 bg-brand-dark/5 text-xs font-semibold font-sans text-brand-dark/60">Esc</kbd>
        </div>

        <div>
          <p className="px-1 pb-1.5 text-xs font-semibold text-brand-dark/55">{words.length ? "Resultados" : "Lo más buscado"}</p>
          {hits.length === 0 ? (
            <p className="px-1 py-4 text-sm text-brand-dark/65 leading-relaxed">
              No encontramos nada con esa palabra. Probá con otra, o escribile a Ennea por WhatsApp desde
              &ldquo;Mi cuenta&rdquo; y te decimos dónde está.
            </p>
          ) : (
            <ul id="admin-command-results" role="listbox" aria-label="Resultados" className="max-h-[50vh] overflow-y-auto space-y-0.5">
              {hits.map((hit, i) => {
                const Icon = hit.icon;
                return (
                  <li key={hit.key} id={`admin-command-${i}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onClick={() => go(hit.href)}
                      onMouseEnter={() => setActive(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer ${i === active ? "bg-brand-dark/5" : ""}`}
                    >
                      <span className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                        hit.lockedPlan ? "bg-[#F6F1E6] text-[#7A5E1C]" : "bg-[var(--admin-tint)] text-[var(--admin-ink)]"
                      }`}>
                        <Icon className="w-4 h-4" aria-hidden />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-brand-dark truncate">{hit.label}</span>
                        <span className="block text-xs text-brand-dark/60 truncate">{hit.detail}</span>
                      </span>
                      {hit.lockedPlan && (
                        <span className="shrink-0 inline-flex items-center h-5 px-2 rounded-full bg-[#F6F1E6] text-[#7A5E1C] text-[11px] font-bold">
                          {PLAN_LABELS[hit.lockedPlan]}
                        </span>
                      )}
                      <span className="hidden sm:inline shrink-0 text-xs text-brand-dark/55">{hit.kind}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-dark/55">
          <span>Enter abre el resaltado</span>
          <span>Flechas para moverte</span>
          <span>Esc cierra</span>
        </p>
      </div>
    </div>
  );
}
