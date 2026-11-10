"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface TenantHit { _id: string; name: string; slug: string; email: string; status: string }

const PAGES: { label: string; href: string }[] = [
  { label: "Qué atender hoy", href: "/superadmin" },
  { label: "Negocios", href: "/superadmin/tenants" },
  { label: "Nuevo negocio", href: "/superadmin/tenants/nuevo" },
  { label: "Solicitudes", href: "/superadmin/solicitudes" },
  { label: "Cobros", href: "/superadmin/cobros" },
  { label: "Pagos", href: "/superadmin/pagos" },
  { label: "Avisos", href: "/superadmin/avisos" },
  { label: "Actividad", href: "/superadmin/actividad" },
  { label: "Errores", href: "/superadmin/errores" },
];

const STATUS_LABELS: Record<string, string> = { suspended: "Suspendido", inactive: "Inactivo" };

/** Buscador rápido (Ctrl+K): salta a un negocio por nombre, slug o correo, o a una sección. */
export default function SuperadminCommand({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tenants, setTenants] = useState<TenantHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Negocios que calzan con lo escrito (con una pausa corta para no pedir en cada tecla).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/superadmin/tenants?limit=8${q ? `&search=${encodeURIComponent(q)}` : ""}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { tenants: [] }))
        .then((d) => { setTenants(d.tenants ?? []); setActive(0); })
        .catch(() => {});
    }, q ? 180 : 0);
    return () => { clearTimeout(t); controller.abort(); };
  }, [open, query]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => ({ key: p.href, label: p.label, detail: "Sección", href: p.href }));
    const hits = tenants.map((t) => ({
      key: t._id, label: t.name, href: `/superadmin/tenants/${t._id}`,
      detail: [t.slug, STATUS_LABELS[t.status]].filter(Boolean).join(" · "),
    }));
    return q ? [...hits, ...pages] : [...pages, ...hits];
  }, [query, tenants]);

  if (!open) return null;

  const go = (href: string) => { onClose(); setQuery(""); router.push(href); };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active].href); }
  }

  return (
    <div className="sa-modal-backdrop" style={{ alignItems: "flex-start", paddingTop: "12vh" }} role="dialog" aria-modal="true" aria-label="Buscar" onClick={onClose}>
      <div className="sa-modal" style={{ maxWidth: 560, padding: 0, gap: 0 }} onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: "1px solid var(--sa-line)" }}>
          <Search className="w-4 h-4 shrink-0 sa-muted" aria-hidden />
          <input
            ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un negocio o una sección..." aria-label="Buscar un negocio o una sección"
            className="flex-1 min-w-0 bg-transparent py-3.5 text-[15px]" style={{ border: 0, outline: "none", color: "var(--sa-ink)", fontFamily: "inherit" }}
          />
          <span className="sa-kbd">Esc</span>
        </div>
        <ul role="listbox" aria-label="Resultados" className="max-h-[52vh] overflow-y-auto p-2" style={{ margin: 0, listStyle: "none" }}>
          {items.length === 0 && <li className="sa-empty" style={{ padding: "24px 12px" }}>Sin resultados</li>}
          {items.map((item, i) => (
            <li key={item.key} role="option" aria-selected={i === active}>
              <button
                type="button" onClick={() => go(item.href)} onMouseEnter={() => setActive(i)}
                className="w-full flex items-center justify-between gap-3 px-3 text-left cursor-pointer"
                style={{ minHeight: 40, border: 0, borderRadius: 6, fontFamily: "inherit", fontSize: 14, color: "var(--sa-ink)", background: i === active ? "var(--sa-hover)" : "transparent" }}
              >
                <span className="min-w-0 truncate" style={{ fontWeight: 500 }}>{item.label}</span>
                <span className="shrink-0 text-xs sa-muted">{item.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
