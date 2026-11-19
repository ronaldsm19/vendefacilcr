"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronsUpDown, Lock, LogOut, MessageCircleQuestion, Search, X } from "lucide-react";
import { ROLE_LABELS, type Role, type Feature } from "@/lib/permissions";
import { PLAN_LABELS } from "@/lib/billing";
import { usePendingComandas } from "@/components/admin/PendingComandasContext";
import { EnneaMark } from "@/components/brand/EnneaMark";
import { waLink } from "@/lib/contacto";
import { isActiveItem, visibleNav, type VisibleGroup, type VisibleItem } from "@/lib/adminNav";

/** Secciones donde se resuelve una comanda sin cobrar: ahí va el contador de pendientes. */
const PENDING_BADGE_FEATURES: Feature[] = ["salon", "comandas"];

/** Qué grupos dejó abiertos cada negocio en esta computadora. */
const openKey = (tenant: string) => `vf_nav_open_${tenant}`;

function readOpen(tenant: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(openKey(tenant));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** "Soda La Esquina" → "SE". Solo cuentan las palabras con letras: "(prueba)" o "&" no. */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  if (words.length === 0) return "·";
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`).toUpperCase();
}

export default function AdminSidebar({
  onClose,
  onSearch,
  tenantName,
  logoUrl,
  role,
  plan,
  planLimits,
  userName,
}: {
  onClose?: () => void;
  /** Abre el buscador (el mismo de Ctrl+K). */
  onSearch: () => void;
  tenantName?: string;
  logoUrl?: string;
  role: Role;
  plan: string;
  planLimits: boolean;
  userName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const tenant = pathname.split("/")[1];
  const base = `/${tenant}/admin`;
  const nav = visibleNav({ role, plan, planLimits }, base);
  const isActive = (item: VisibleItem) => isActiveItem(item, pathname, base);

  const { badgeCount: pendingComandas } = usePendingComandas();
  const [posCartCount, setPosCartCount] = useState(0);

  useEffect(() => {
    function readCount() {
      try {
        const raw = localStorage.getItem(`pos_cart_${tenant}`);
        if (!raw) { setPosCartCount(0); return; }
        const draft = JSON.parse(raw);
        setPosCartCount(Array.isArray(draft.cart) ? draft.cart.length : 0);
      } catch {
        setPosCartCount(0);
      }
    }
    readCount();
    window.addEventListener("pos-cart-update", readCount);
    return () => window.removeEventListener("pos-cart-update", readCount);
  }, [tenant]);

  // Grupos abiertos: lo que la persona dejó en esta computadora. Sin nada guardado, Vender, que es lo
  // que más se usa. El de la sección abierta siempre arranca abierto, para que se vea dónde está.
  const activeGroupId = nav.groups.find((g) => g.items.some(isActive))?.id ?? null;
  const [openState, setOpenState] = useState<Record<string, boolean>>(() => {
    const saved = readOpen(tenant);
    return activeGroupId ? { ...saved, [activeGroupId]: true } : saved;
  });
  const isOpen = (g: VisibleGroup) => openState[g.id] ?? (g.id === activeGroupId || g.id === "vender");

  // Al llegar a una sección (por el buscador, por un acceso de Inicio) su grupo se abre, para que se
  // vea dónde está. Se ajusta durante el render, no en un efecto.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (activeGroupId && openState[activeGroupId] === false) {
      setOpenState({ ...openState, [activeGroupId]: true });
    }
  }

  function toggleGroup(g: VisibleGroup) {
    setOpenState((prev) => {
      const current = prev[g.id] ?? (g.id === activeGroupId || g.id === "vender");
      const next = { ...prev, [g.id]: !current };
      try { localStorage.setItem(openKey(tenant), JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push(`${base}/login`);
    router.refresh();
  }

  const displayName = tenantName || tenant;
  const person = role === "admin" ? (userName && userName !== "Administrador" ? userName : "Administración") : (userName || ROLE_LABELS[role]);

  const pendingFor = (item: VisibleItem) =>
    !item.lockedPlan && PENDING_BADGE_FEATURES.includes(item.feature) && pendingComandas > 0;

  // Una función y no un componente: un componente definido acá adentro se volvería a montar en cada render.
  const renderRow = (item: VisibleItem, top = false) => {
    const active = isActive(item);
    const Icon = item.icon;
    const alert = pendingFor(item);
    const locked = item.lockedPlan;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={locked ? `Disponible en el plan ${PLAN_LABELS[locked]}` : undefined}
        className={`flex items-center gap-2.5 px-3 rounded-xl text-sm transition-colors duration-150 ${top ? "min-h-10 font-semibold" : "min-h-9 font-medium"} ${
          active
            ? "bg-[var(--admin-pill)] text-[var(--admin-on-pill)] font-semibold shadow-sm"
            : alert
            // Resaltado aunque no sea la sección abierta: es lo que hace que se note sin tener que
            // entrar a buscar.
            ? "text-amber-100 bg-amber-400/10 ring-1 ring-amber-400/30 hover:bg-amber-400/15"
            : locked
            ? "text-white/55 hover:text-white/80 hover:bg-white/5"
            : top
            ? "text-white/90 hover:text-white hover:bg-white/8"
            : "text-white/70 hover:text-white hover:bg-white/8"
        }`}
      >
        <Icon className={`${top ? "w-[18px] h-[18px]" : "w-4 h-4"} shrink-0`} aria-hidden />
        <span className="flex-1 min-w-0 truncate">{item.label}</span>
        {alert && (
          <span
            title={`${pendingComandas} ${pendingComandas === 1 ? "comanda pendiente" : "comandas pendientes"} de cobrar`}
            className={`relative text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0 ${
              active ? "bg-white/25" : "bg-amber-400 text-brand-dark"
            }`}
          >
            {!active && <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-40" />}
            <span className="relative">{pendingComandas}</span>
          </span>
        )}
        {item.feature === "pos" && posCartCount > 0 && !locked && (
          <span className="text-xs font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
            {posCartCount}
          </span>
        )}
        {/* Dentro de un grupo no cabe el nombre del plan sin cortar el de la sección: va el candado, y
            el plan en el título, en el buscador y en la pantalla de la sección. */}
        {locked && (
          <span className={`inline-flex items-center gap-1 h-5 rounded-full text-[11px] font-bold shrink-0 ${top ? "px-1.5" : "w-5 justify-center"} ${
            active ? "bg-white/25" : "bg-[#B8902F]/20 text-[#E2C374]"
          }`}>
            <Lock className="w-2.5 h-2.5" aria-hidden />
            {top ? PLAN_LABELS[locked] : <span className="sr-only">Plan {PLAN_LABELS[locked]}</span>}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="w-64 h-screen bg-brand-dark flex flex-col overflow-hidden">
      {/* El negocio: su logo (o sus iniciales en su color) y su nombre. Altura fija. */}
      <div className="shrink-0 px-4 pt-5 pb-4 border-b border-white/10 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-white/15" />
        ) : (
          <span aria-hidden className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold ring-1 ring-white/15 bg-[var(--admin-fill)] text-[var(--admin-on-fill)]">
            {initialsOf(displayName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-brand text-lg font-bold text-white leading-tight truncate">{displayName}</p>
          <p className="text-white/55 text-xs mt-0.5 truncate">
            {role === "admin" ? "Panel de administración" : `${userName} · ${ROLE_LABELS[role]}`}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="shrink-0 px-3 pt-3">
        <button
          type="button"
          onClick={onSearch}
          className="w-full flex items-center gap-2.5 h-10 px-3 rounded-xl border border-white/12 bg-white/5 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">Buscar o ir a…</span>
          <kbd className="hidden lg:inline-flex items-center h-5 px-1.5 rounded-md bg-white/10 text-[11px] font-semibold font-sans text-white/70">Ctrl K</kbd>
        </button>
      </div>

      {/* Lo único que se scrollea; min-h-0 deja que se encoja en vez de empujar el pie fuera de la
          pantalla en pantallas bajas. */}
      <nav aria-label="Secciones" className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5">
        {nav.home && renderRow(nav.home, true)}

        {nav.flat
          ? nav.groups.flatMap((g) => g.items).map((item) => renderRow(item, true))
          : nav.groups.map((g) => {
              const open = isOpen(g);
              const GroupIcon = g.icon;
              const hasActive = g.id === activeGroupId;
              const groupAlert = !open && g.items.some(pendingFor);
              const allLocked = g.items.every((i) => i.lockedPlan);
              const panelId = `nav-${g.id}`;
              return (
                <div key={g.id} className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className={`w-full flex items-center gap-2.5 min-h-10 px-3 rounded-xl text-sm font-semibold text-left transition-colors cursor-pointer hover:bg-white/8 hover:text-white ${
                      allLocked ? "text-white/55" : "text-white/90"
                    }`}
                  >
                    <GroupIcon className="w-[18px] h-[18px] shrink-0" aria-hidden />
                    <span className="flex-1 min-w-0 flex items-center gap-2 truncate">
                      {g.label}
                      {hasActive && !open && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--admin-pill)] shrink-0" title="Estás en esta sección" />
                      )}
                    </span>
                    {groupAlert && (
                      <span
                        title={`${pendingComandas} ${pendingComandas === 1 ? "comanda pendiente" : "comandas pendientes"} de cobrar`}
                        className="text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0 bg-amber-400 text-brand-dark"
                      >
                        {pendingComandas}
                      </span>
                    )}
                    {allLocked && g.items[0].lockedPlan && (
                      <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[11px] font-bold shrink-0 bg-[#B8902F]/20 text-[#E2C374]">
                        {PLAN_LABELS[g.items[0].lockedPlan]}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 shrink-0 text-white/55 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {open && (
                    <div id={panelId} className="ml-[21px] pl-2 border-l border-white/10 space-y-0.5 py-0.5">
                      {g.items.map((item) => renderRow(item))}
                    </div>
                  )}
                </div>
              );
            })}
      </nav>

      {/* Pie: Configuración y la cuenta. Altura fija, nunca se scrollea. */}
      <div className="shrink-0 px-3 pt-3 pb-3 border-t border-white/10 space-y-1">
        {nav.settings && renderRow(nav.settings, true)}
        <AccountMenu
          person={person}
          items={nav.account}
          isActive={isActive}
          onLogout={handleLogout}
        />
        <div className="flex items-center gap-1.5 px-3 pt-1.5 text-xs text-white/55">
          <EnneaMark size={14} dome="currentColor" />
          <span className="font-semibold tracking-wide">Ennea</span>
        </div>
      </div>
    </aside>
  );
}

/** El nombre de quien entró, abajo: abre su cuenta, la ayuda y cerrar sesión. */
function AccountMenu({
  person,
  items,
  isActive,
  onLogout,
}: {
  person: string;
  items: VisibleItem[];
  isActive: (item: VisibleItem) => boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const accountActive = items.some(isActive);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-2 z-20 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item) ? "page" : undefined}
                className={`flex items-center gap-2.5 min-h-10 px-3 rounded-xl text-sm text-brand-dark hover:bg-brand-dark/5 ${isActive(item) ? "font-semibold bg-brand-dark/5" : ""}`}
              >
                <Icon className="w-4 h-4 text-brand-dark/60" aria-hidden />
                {item.label}
              </Link>
            );
          })}
          <a
            href={waLink("Hola, necesito ayuda con el panel de Ennea.")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 min-h-10 px-3 rounded-xl text-sm text-brand-dark hover:bg-brand-dark/5"
          >
            <MessageCircleQuestion className="w-4 h-4 text-brand-dark/60" aria-hidden />
            Ayuda por WhatsApp
          </a>
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2.5 min-h-10 px-3 rounded-xl text-sm text-brand-dark hover:bg-brand-dark/5 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-brand-dark/60" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`w-full flex items-center gap-2.5 min-h-12 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
          accountActive ? "bg-white/10" : "hover:bg-white/8"
        }`}
      >
        <span aria-hidden className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[13px] font-bold bg-white/10 ring-1 ring-[#B8902F]/60 text-[#E2C374]">
          {person.charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-white truncate">{person}</span>
          <span className="block text-xs text-white/55">Mi cuenta</span>
        </span>
        <ChevronsUpDown className="w-4 h-4 shrink-0 text-white/55" aria-hidden />
      </button>
    </div>
  );
}
