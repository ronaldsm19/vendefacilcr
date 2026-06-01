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
} from "lucide-react";

function buildNavItems(base: string) {
  return [
    { href: base,                       label: "Dashboard",     icon: LayoutDashboard },
    { href: `${base}/productos`,        label: "Productos",     icon: Package },
    { href: `${base}/inventario`,       label: "Inventario",    icon: Warehouse },
    { href: `${base}/materiales`,       label: "Materiales",    icon: FlaskConical },
    { href: `${base}/recetas`,          label: "Recetas",       icon: BookOpen },
    { href: `${base}/pedidos`,          label: "Pedidos",       icon: ShoppingBag },
    { href: `${base}/gastos`,           label: "Gastos",         icon: Receipt },
    { href: `${base}/finanzas`,         label: "Finanzas",       icon: TrendingUp },
    { href: `${base}/pos`,              label: "Punto de venta", icon: MonitorCheck },
    { href: `${base}/cierre-de-caja`,   label: "Cierre de caja", icon: BookCheck },
    { href: `${base}/configuracion`,    label: "Configuración",  icon: Settings },
  ];
}

export default function AdminSidebar({
  onClose,
  tenantName,
  logoUrl,
}: {
  onClose?: () => void;
  tenantName?: string;
  logoUrl?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const tenant = pathname.split("/")[1];
  const base = `/${tenant}/admin`;
  const navItems = buildNavItems(base);

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
    <aside className="w-60 h-full min-h-screen bg-brand-dark flex flex-col">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-brand text-xl font-bold gradient-text truncate">{displayName}</p>
            <p className="text-white/40 text-xs mt-0.5">Panel de administración</p>
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

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
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

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
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
