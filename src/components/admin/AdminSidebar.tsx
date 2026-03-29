"use client";

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
} from "lucide-react";

function buildNavItems(base: string) {
  return [
    { href: base,                       label: "Dashboard",     icon: LayoutDashboard },
    { href: `${base}/productos`,        label: "Productos",     icon: Package },
    { href: `${base}/inventario`,       label: "Inventario",    icon: Warehouse },
    { href: `${base}/materiales`,       label: "Materiales",    icon: FlaskConical },
    { href: `${base}/recetas`,          label: "Recetas",       icon: BookOpen },
    { href: `${base}/pedidos`,          label: "Pedidos",       icon: ShoppingBag },
    { href: `${base}/gastos`,           label: "Gastos",        icon: Receipt },
    { href: `${base}/finanzas`,         label: "Finanzas",      icon: TrendingUp },
    { href: `${base}/configuracion`,    label: "Configuración", icon: Settings },
  ];
}

export default function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  // Derive tenant from URL: /dulcepecado/admin/... → "dulcepecado"
  const tenant = pathname.split("/")[1];
  const base = `/${tenant}/admin`;
  const navItems = buildNavItems(base);

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push(`${base}/login`);
    router.refresh();
  }

  return (
    <aside className="w-60 h-full min-h-screen bg-brand-dark flex flex-col">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="font-brand text-xl font-bold gradient-text">Dulce Pecado</p>
          <p className="text-white/40 text-xs mt-0.5">Panel de administración</p>
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
              {item.label}
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
