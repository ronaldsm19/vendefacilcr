"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  CreditCard,
  Activity,
  LogOut,
  X,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/superadmin",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/superadmin/tenants",    label: "Tenants",     icon: Building2 },
  { href: "/superadmin/solicitudes",label: "Solicitudes", icon: ClipboardList },
  { href: "/superadmin/pagos",      label: "Pagos",       icon: CreditCard },
  { href: "/superadmin/actividad",  label: "Actividad",   icon: Activity },
];

export default function SuperadminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    await fetch("/api/superadmin/auth/logout", { method: "POST" });
    router.push("/superadmin/login");
    router.refresh();
  }

  return (
    <aside
      className="w-60 h-full min-h-screen flex flex-col"
      style={{ background: "#06060A", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Brand */}
      <div
        className="px-6 py-6 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center saas-accent-bg"
          >
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="font-brand text-sm font-bold saas-accent-text">VendeFácil</p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Superadmin</p>
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
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/superadmin"
              ? pathname === "/superadmin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "saas-accent-bg text-white"
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
      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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
