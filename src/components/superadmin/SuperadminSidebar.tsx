"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnneaMark, ENNEA_COLORS } from "@/components/brand/EnneaMark";
import { REVIEW_CHANGED_EVENT } from "@/components/superadmin/pagos/paymentStatus";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  CreditCard,
  Activity,
  Bug,
  Wallet,
  Megaphone,
  LogOut,
  Search,
  X,
} from "lucide-react";

const navItems = [
  { href: "/superadmin",            label: "Hoy",         icon: LayoutDashboard },
  { href: "/superadmin/tenants",    label: "Negocios",    icon: Building2 },
  { href: "/superadmin/solicitudes",label: "Solicitudes", icon: ClipboardList },
  { href: "/superadmin/cobros",     label: "Cobros",      icon: Wallet },
  { href: "/superadmin/pagos",      label: "Pagos",       icon: CreditCard },
  { href: "/superadmin/avisos",     label: "Avisos",      icon: Megaphone },
  { href: "/superadmin/actividad",  label: "Actividad",   icon: Activity },
  { href: "/superadmin/errores",    label: "Errores",     icon: Bug },
];

export function SuperadminBrand() {
  return (
    <div className="sa-brand">
      <EnneaMark size={30} className="sa-brand-mark" dome={ENNEA_COLORS.navy} />
      <div>
        <p className="sa-brand-name" style={{ margin: 0 }}>Ennea</p>
        <p className="sa-brand-sub" style={{ margin: 0 }}>Consola</p>
      </div>
    </div>
  );
}

export default function SuperadminSidebar({ onClose, onSearch }: { onClose?: () => void; onSearch?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  /** Comprobantes que esperan revisión: el número junto a "Pagos". Se vuelve a pedir al cambiar de pantalla. */
  const [toReview, setToReview] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      fetch("/api/superadmin/pagos/por-revisar")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setToReview(d.count ?? 0); })
        .catch(() => {});
    };
    refresh();
    // La revisión de un comprobante avisa con este evento para que el número baje sin cambiar de pantalla.
    window.addEventListener(REVIEW_CHANGED_EVENT, refresh);
    return () => { alive = false; window.removeEventListener(REVIEW_CHANGED_EVENT, refresh); };
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/superadmin/auth/logout", { method: "POST" });
    router.push("/superadmin/login");
    router.refresh();
  }

  return (
    <aside className="sa-sidebar">
      {/* Marca: altura fija, nunca se achica ni se desplaza */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3">
        <SuperadminBrand />
        {onClose && (
          <button onClick={onClose} className="sa-icon-btn" aria-label="Cerrar menú">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {onSearch && (
        <div className="shrink-0 px-3 pb-2">
          <button type="button" onClick={onSearch} className="sa-nav-link" style={{ border: "1px solid var(--sa-line)", color: "var(--sa-ink-2)" }}>
            <Search aria-hidden />
            <span className="flex-1">Buscar negocio</span>
            <span className="sa-kbd">Ctrl K</span>
          </button>
        </div>
      )}

      {/* Navegación: la única zona que se desplaza (min-h-0 deja que se encoja dentro del aside) */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-0.5" aria-label="Secciones">
        {navItems.map((item) => {
          const isActive = item.href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onClose} className="sa-nav-link" aria-current={isActive ? "page" : undefined}>
              <Icon aria-hidden />
              {item.label}
              {item.href === "/superadmin/pagos" && toReview > 0 && (
                <span className="sa-nav-count" aria-label={`${toReview} por revisar`}>{toReview}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Salir: altura fija */}
      <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid var(--sa-line)" }}>
        <button onClick={handleLogout} className="sa-nav-link">
          <LogOut aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
