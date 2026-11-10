"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Receipt,
  TrendingUp,
  Settings,
  LogOut,
  X,
  Warehouse,
  FlaskConical,
  BookOpen,
  MonitorCheck,
  BookCheck,
  UserCircle,
  LayoutGrid,
  Users,
  ClipboardList,
  Clock,
  Wallet,
  Lock,
} from "lucide-react";
import { can, planNeededFor, seesLockedSections, ROLE_LABELS, type Role, type Feature } from "@/lib/permissions";
import { PLAN_KEYS, PLAN_LABELS } from "@/lib/billing";
import { usePendingComandas } from "@/components/admin/PendingComandasContext";

/** Secciones donde se resuelve una comanda sin cobrar: ahí va el contador de pendientes. */
const PENDING_BADGE_FEATURES: Feature[] = ["salon", "comandas"];

function buildNavItems(base: string): { href: string; label: string; icon: typeof LayoutDashboard; feature: Feature }[] {
  return [
    { href: base,                       label: "Dashboard",     icon: LayoutDashboard, feature: "dashboard" },
    { href: `${base}/productos`,        label: "Productos",     icon: Package,         feature: "productos" },
    { href: `${base}/inventario`,       label: "Inventario",    icon: Warehouse,       feature: "inventario" },
    { href: `${base}/materiales`,       label: "Materiales",    icon: FlaskConical,    feature: "materiales" },
    { href: `${base}/recetas`,          label: "Recetas",       icon: BookOpen,        feature: "recetas" },
    { href: `${base}/pedidos`,          label: "Pedidos y ventas", icon: ShoppingBag,  feature: "pedidos" },
    { href: `${base}/gastos`,           label: "Gastos",         icon: Receipt,         feature: "gastos" },
    { href: `${base}/finanzas`,         label: "Finanzas",       icon: TrendingUp,      feature: "finanzas" },
    { href: `${base}/pos`,              label: "Punto de venta", icon: MonitorCheck,    feature: "pos" },
    { href: `${base}/cierre-de-caja`,   label: "Cierre de caja", icon: BookCheck,       feature: "cierre-de-caja" },
    { href: `${base}/jornada`,          label: "Jornada laboral", icon: Clock,          feature: "jornada" },
    { href: `${base}/planilla`,         label: "Planilla",        icon: Wallet,         feature: "planilla" },
    { href: `${base}/salon`,            label: "Salón",           icon: LayoutGrid,     feature: "salon" },
    { href: `${base}/comandas`,         label: "Comandas",       icon: ClipboardList,   feature: "comandas" },
    { href: `${base}/usuarios`,         label: "Usuarios",       icon: Users,           feature: "usuarios" },
    { href: `${base}/configuracion`,    label: "Configuración",  icon: Settings,        feature: "configuracion" },
    { href: `${base}/perfil`,           label: "Perfil",         icon: UserCircle,      feature: "perfil" },
  ];
}

export default function AdminSidebar({
  onClose,
  tenantName,
  logoUrl,
  role,
  plan,
  planLimits,
  userName,
}: {
  onClose?: () => void;
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
  // Lo que el plan no incluye se oculta, salvo para el dueño de un negocio con límites: a él se le
  // muestra al final, con candado, para que sepa que existe y en qué plan está.
  const showLocked = seesLockedSections({ role, planLimits });
  const allowed = buildNavItems(base)
    .filter((i) => can({ role }, i.feature))
    .map((i) => ({ ...i, lockedPlan: planNeededFor({ plan, planLimits }, i.feature) }));
  const navItems = allowed.filter((i) => !i.lockedPlan);
  const lockedItems = showLocked ? allowed.filter((i) => i.lockedPlan) : [];

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

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push(`${base}/login`);
    router.refresh();
  }

  const displayName = tenantName || tenant;

  return (
    <aside className="w-60 h-screen bg-brand-dark flex flex-col overflow-hidden">
      {/* Brand — altura fija, nunca se achica ni se scrollea */}
      <div className="shrink-0 px-6 py-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-brand text-xl font-bold gradient-text truncate">{displayName}</p>
            <p className="text-white/40 text-xs mt-0.5 truncate">
              {role === "admin" ? "Panel de administración" : `${userName} · ${ROLE_LABELS[role]}`}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav — única zona que se scrollea; min-h-0 es necesario para que un hijo flex
          pueda encogerse por debajo de su contenido y así respetar overflow-y-auto en vez
          de simplemente estirar todo el <aside> (lo que dejaba la marca o "Cerrar sesión"
          fuera de pantalla, sin aviso, en pantallas de poca altura o con muchos ítems). */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === base
              ? pathname === base
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          // El contador ya viene filtrado por rol: al mesero le llegan solo las suyas.
          const alert = PENDING_BADGE_FEATURES.includes(item.feature) && pendingComandas > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "gradient-bg text-white shadow-md"
                  : alert
                  // Resaltado aunque no sea la sección abierta: es lo que hace que se note sin
                  // tener que entrar a buscar.
                  ? "text-amber-200 bg-amber-400/10 ring-1 ring-amber-400/30 hover:bg-amber-400/15"
                  : "text-white/50 hover:text-white hover:bg-white/8"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {alert && (
                <span
                  title={`${pendingComandas} ${pendingComandas === 1 ? "comanda pendiente" : "comandas pendientes"} de cobrar`}
                  className={`relative text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0 ${
                    isActive ? "bg-white/25 text-white" : "bg-amber-400 text-brand-dark"
                  }`}
                >
                  <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-40" />
                  <span className="relative">{pendingComandas}</span>
                </span>
              )}
              {item.label === "Punto de venta" && posCartCount > 0 && (
                <span className="text-xs font-bold bg-white/20 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  {posCartCount}
                </span>
              )}
            </Link>
          );
        })}

        {PLAN_KEYS.map((planKey) => {
          const items = lockedItems.filter((i) => i.lockedPlan === planKey);
          if (items.length === 0) return null;
          return (
            <div key={planKey} className="pt-4">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/30">
                Plan {PLAN_LABELS[planKey]}
              </p>
              {items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={`Disponible en el plan ${PLAN_LABELS[planKey]}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                      isActive ? "bg-white/10 text-white/80" : "text-white/35 hover:text-white/70 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    <Lock className="w-3 h-3 shrink-0 text-white/30" aria-label="Bloqueada" />
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Logout — altura fija, nunca se achica ni se scrollea */}
      <div className="shrink-0 px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/8 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
