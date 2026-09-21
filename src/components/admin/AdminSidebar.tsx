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
} from "lucide-react";
import { can, ROLE_LABELS, type Role, type Feature } from "@/lib/permissions";

function buildNavItems(base: string): { href: string; label: string; icon: typeof LayoutDashboard; feature: Feature; premium?: true }[] {
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
    { href: `${base}/salon`,            label: "Salón",           icon: LayoutGrid,     feature: "salon" },
    { href: `${base}/comandas`,         label: "Comandas",       icon: ClipboardList,   feature: "comandas", premium: true },
    { href: `${base}/usuarios`,         label: "Usuarios",       icon: Users,           feature: "usuarios", premium: true },
    { href: `${base}/configuracion`,    label: "Configuración",  icon: Settings,        feature: "configuracion" },
    { href: `${base}/perfil`,           label: "Perfil",         icon: UserCircle,      feature: "perfil" },
  ];
}

export default function AdminSidebar({
  onClose,
  tenantName,
  logoUrl,
  role,
  isPremium,
  userName,
}: {
  onClose?: () => void;
  tenantName?: string;
  logoUrl?: string;
  role: Role;
  isPremium: boolean;
  userName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const tenant = pathname.split("/")[1];
  const base = `/${tenant}/admin`;
  const navItems = buildNavItems(base).filter(
    (i) => can({ role }, i.feature) && (!i.premium || isPremium)
  );

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

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "gradient-bg text-white shadow-md"
                  : "text-white/50 hover:text-white hover:bg-white/8"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Punto de venta" && posCartCount > 0 && (
                <span className="text-xs font-bold bg-white/20 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  {posCartCount}
                </span>
              )}
            </Link>
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
