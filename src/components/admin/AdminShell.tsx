"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ReminderToast from "@/components/admin/ReminderToast";
import { AdminSessionProvider, type AdminSession } from "@/components/admin/SessionContext";
import { PendingComandasProvider, usePendingComandas } from "@/components/admin/PendingComandasContext";
import { can, featureForPath, homePathFor, PREMIUM_FEATURES } from "@/lib/permissions";

interface TenantBranding {
  tenantName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const DEFAULT_BRANDING: TenantBranding = {
  tenantName: "",
  logoUrl: "",
  primaryColor: "#6366F1",
  secondaryColor: "#8B5CF6",
  accentColor: "#F59E0B",
};

/**
 * En el teléfono el menú vive cerrado, así que el contador de comandas pendientes no se vería
 * nunca: el botón de la hamburguesa lleva su propio aviso. Va aparte porque necesita leer el
 * provider que monta AdminShell.
 */
function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
  const { badgeCount } = usePendingComandas();
  return (
    <button
      onClick={onOpen}
      className="relative p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      aria-label={badgeCount > 0 ? `Abrir menú · ${badgeCount} comandas pendientes de cobrar` : "Abrir menú"}
    >
      <Menu className="w-5 h-5" />
      {badgeCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-brand-dark text-[10px] font-bold flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-50" />
          <span className="relative">{badgeCount}</span>
        </span>
      )}
    </button>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [session, setSession] = useState<AdminSession | null>(null);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Auth guard — skip on login page
  useEffect(() => {
    if (pathname.endsWith("/admin/login")) {
      setAuthChecked(true);
      return;
    }
    fetch("/api/admin/auth/me").then(async (res) => {
      if (res.status === 401) {
        const tenant = pathname.split("/")[1];
        router.replace(`/${tenant}/admin/login`);
      } else {
        const data = await res.json();
        setBranding({
          tenantName:     data.tenantName     || pathname.split("/")[1],
          logoUrl:        data.logoUrl        || "",
          primaryColor:   data.primaryColor   || "#6366F1",
          secondaryColor: data.secondaryColor || "#8B5CF6",
          accentColor:    data.accentColor    || "#F59E0B",
        });
        const base = `/${pathname.split("/")[1]}/admin`;
        const s: AdminSession = {
          role: data.role ?? "admin",
          userId: data.userId ?? "",
          name: data.name ?? "",
          email: data.email ?? "",
          plan: data.plan ?? "emprende",
          isPremium: !!data.isPremium,
          tenantSlug: data.tenantSlug,
          tenantName: data.tenantName || pathname.split("/")[1],
        };
        if (s.role !== "admin" && !s.isPremium) {                 // tenant degradado con staff logueado
          await fetch("/api/admin/auth/logout", { method: "POST" });
          router.replace(`${base}/login`);
          return;
        }
        const feature = featureForPath(pathname, base);
        if (feature && (!can(s, feature) || (PREMIUM_FEATURES.includes(feature) && !s.isPremium))) {
          router.replace(homePathFor(s.role, base));
          return;                                                  // no setAuthChecked: el cambio de pathname re-ejecuta el efecto
        }
        setSession(s);
        setAuthChecked(true);
      }
    }).catch(() => {
      const tenant = pathname.split("/")[1];
      router.replace(`/${tenant}/admin/login`);
    });
  }, [pathname, router]);

  // Inject tenant CSS vars on <html> so Radix portals (modals, dropdowns)
  // also inherit the right colors — they render outside this component's div.
  useEffect(() => {
    const root = document.documentElement;
    const gradient = `linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 50%, ${branding.accentColor} 100%)`;
    root.style.setProperty("--color-brand-pink",   branding.primaryColor);
    root.style.setProperty("--color-brand-orange",  branding.secondaryColor);
    root.style.setProperty("--color-brand-yellow",  branding.accentColor);
    root.style.setProperty("--gradient-brand",      gradient);
    return () => {
      root.style.removeProperty("--color-brand-pink");
      root.style.removeProperty("--color-brand-orange");
      root.style.removeProperty("--color-brand-yellow");
      root.style.removeProperty("--gradient-brand");
    };
  }, [branding]);

  if (pathname.endsWith("/admin/login")) {
    return <div className="min-h-screen bg-brand-muted/20">{children}</div>;
  }

  if (!authChecked || !session) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#F8F0F5" }}>
        <p className="text-brand-dark/30 text-sm">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <AdminSessionProvider value={session}>
      {/* Dentro del provider de sesión y por fuera del layout: así el contador de comandas se pide
          una sola vez y lo leen tanto el menú (que se monta dos veces: escritorio y cajón) como la
          pantalla de turno. */}
      <PendingComandasProvider>
      <div className="flex h-screen overflow-hidden bg-brand-muted/20">
        {/* Desktop sidebar — el propio AdminSidebar maneja su altura y su scroll interno */}
        <div className="hidden lg:flex shrink-0 h-screen">
          <AdminSidebar tenantName={branding.tenantName} logoUrl={branding.logoUrl} role={session.role} isPremium={session.isPremium} userName={session.name} />
        </div>

        {/* Mobile/tablet sidebar drawer */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
              <AdminSidebar tenantName={branding.tenantName} logoUrl={branding.logoUrl} role={session.role} isPremium={session.isPremium} userName={session.name} onClose={() => setSidebarOpen(false)} />
            </div>
          </>
        )}

        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile/tablet top bar */}
          <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-brand-dark shrink-0 z-30">
            <MobileMenuButton onOpen={() => setSidebarOpen(true)} />
            <p className="font-brand text-lg font-bold gradient-text">{branding.tenantName}</p>
          </header>

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>

        <ReminderToast />
      </div>
      </PendingComandasProvider>
    </AdminSessionProvider>
  );
}
