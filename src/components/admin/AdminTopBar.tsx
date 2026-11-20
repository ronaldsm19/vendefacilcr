"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink, Plus } from "lucide-react";
import type { Role } from "@/lib/permissions";
import { activeItem, isActiveItem, locationOf, type VisibleNav } from "@/lib/adminNav";
import HelpButton from "@/components/admin/help/HelpButton";

/**
 * Barra de arriba en la computadora: dónde está uno ("Vender › Punto de venta"), el enlace a la tienda
 * y el botón de vender. La ruta es la misma que muestra el buscador, así se aprende dónde vive cada cosa.
 */
export default function AdminTopBar({ nav, base, role }: { nav: VisibleNav; base: string; role: Role }) {
  const pathname = usePathname();
  const item = activeItem(nav, pathname, base);
  const crumbs = item ? locationOf(item, nav.flat) : [];
  const pos = nav.all.find((i) => i.segment === "pos" && !i.lockedPlan);
  const slug = base.split("/")[1];

  return (
    <header className="hidden lg:flex items-center gap-3 h-14 px-8 shrink-0 bg-white border-b border-brand-dark/10">
      <nav aria-label="Dónde estás" className="flex-1 min-w-0">
        <ol className="flex items-center gap-1.5 text-sm min-w-0">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${i}-${crumb}`} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-brand-dark/35" aria-hidden />}
                <span className={last ? "font-semibold text-brand-dark truncate" : "text-brand-dark/60 truncate"} aria-current={last ? "page" : undefined}>
                  {crumb}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
      <HelpButton base={base} />
      {role !== "mesero" && (
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-brand-dark/15 bg-white text-sm font-medium text-brand-dark hover:bg-brand-dark/5 transition-colors"
        >
          Ver mi tienda
          <ExternalLink className="w-3.5 h-3.5 text-brand-dark/55" aria-hidden />
        </a>
      )}
      {pos && !isActiveItem(pos, pathname, base) && (
        <Link
          href={pos.href}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--admin-fill)] text-[var(--admin-on-fill)] hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Nueva venta
        </Link>
      )}
    </header>
  );
}
