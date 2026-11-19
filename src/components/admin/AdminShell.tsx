"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminCommand from "@/components/admin/AdminCommand";
import { visibleNav } from "@/lib/adminNav";
import { adminBrandVars } from "@/lib/adminBrand";
import { ENNEA_COLORS } from "@/components/brand/EnneaMark";
import ReminderToast from "@/components/admin/ReminderToast";
import TenantNotices from "@/components/admin/TenantNotices";
import { AdminSessionProvider, type AdminSession } from "@/components/admin/SessionContext";
import { PendingComandasProvider, usePendingComandas } from "@/components/admin/PendingComandasContext";
import SessionExpiredDialog from "@/components/admin/SessionExpiredDialog";
import SuspendedScreen from "@/components/admin/SuspendedScreen";
import type { SuspensionNotice } from "@/lib/suspension";
import { usePolling } from "@/hooks/usePolling";
import { watchUnauthorized } from "@/lib/sessionWatch";
import { startApiErrorReporting } from "@/lib/apiErrorReporter";
import {
  can, featureForPath, homePathFor, planAllows, planNeededFor, seesLockedSections, SECTION_LABELS,
} from "@/lib/permissions";
import PlanLockedScreen from "@/components/admin/PlanLockedScreen";

/**
 * Cada diez minutos el panel vuelve a preguntar quién es, y esa llamada renueva la cookie. Una
 * computadora de negocio que queda abierta todo el día nunca se queda sin sesión; una que nadie
 * tocó en 24 h sí, que es lo que se quiere. usePolling se duerme con la pestaña escondida y hace
 * un tiro apenas vuelve a verse, así que al despertar la máquina lo primero que pasa es esto.
 */
const SESSION_PING_MS = 10 * 60 * 1000;

/**
 * Por qué "quién soy" respondió 401: el negocio está suspendido (con el aviso que mandó el servidor),
 * la sesión abierta es de otro negocio, o simplemente no hay sesión (null).
 */
async function denialFrom(res: Response): Promise<{ suspension: SuspensionNotice } | { otherTenant: true } | null> {
  if (res.status !== 401) return null;
  const data = await res.json().catch(() => null) as { code?: string; suspension?: SuspensionNotice } | null;
  if (data?.code === "TENANT_SUSPENDED" && data.suspension) return { suspension: data.suspension };
  if (data?.code === "OTHER_TENANT") return { otherTenant: true };
  return null;
}

/** El negocio de la dirección (/<negocio>/admin/...). */
const slugOf = (pathname: string) => pathname.split("/")[1] ?? "";

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
  const [sessionExpired, setSessionExpired] = useState(false);
  const [suspended, setSuspended] = useState<SuspensionNotice | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const isLoginPage = pathname.endsWith("/admin/login");

  // Ctrl+K (o Cmd+K) abre el buscador desde cualquier pantalla del panel.
  useEffect(() => {
    if (isLoginPage) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoginPage]);

  // El ingreso se abre dentro de este mismo shell (navegación del lado del cliente): al llegar ahí se
  // borra lo de la sesión anterior. Si no, el aviso de sesión vencida (o la sesión y la marca de otro
  // negocio) seguían en pantalla apenas uno volvía a entrar, hasta refrescar.
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  if (isLoginPage && clearedAt !== pathname) {
    setClearedAt(pathname);
    setSessionExpired(false);
    setSuspended(null);
    setSession(null);
    setBranding(DEFAULT_BRANDING);
    setSearchOpen(false);
  } else if (!isLoginPage && clearedAt !== null) {
    setClearedAt(null);
  }

  // Lo que pasa cuando "quién soy" dice que no hay sesión para este negocio: suspendido, aviso; la
  // sesión es de otro negocio (lo abrieron en otra pestaña), al ingreso de este, que explica cuál
  // quedó abierta; vencida, el diálogo de sesión vencida.
  const handleDenied = useCallback(async (res: Response) => {
    // "Quién soy" respondió bien: la sesión sigue viva y el 401 fue de otra cosa. Antes igual salía
    // "Tu sesión venció".
    if (res.status !== 401) return;
    const denial = await denialFrom(res);
    if (denial && "suspension" in denial) setSuspended(denial.suspension);
    else if (denial?.otherTenant) router.replace(`/${slugOf(window.location.pathname)}/admin/login`);
    else setSessionExpired(true);
  }, [router]);

  // Cualquier 401 del panel significa que ya no hay sesión, venga de la pantalla que venga. Puede ser
  // que venció o que suspendieron el negocio: "quién soy" dice cuál, para mostrar el aviso correcto.
  useEffect(() => watchUnauthorized(() => {
    void fetch("/api/admin/auth/me")
      .then(handleDenied)
      .catch(() => setSessionExpired(true));
  }), [handleDenied]);

  // Lo que el panel no pudo hacer (respuestas con error, pedidos sin respuesta) va al registro de
  // errores del superadmin.
  useEffect(() => { startApiErrorReporting(); }, []);

  const pingSession = useCallback(async () => {
    const res = await fetch("/api/admin/auth/me");
    if (res.status === 401) await handleDenied(res);
  }, [handleDenied]);
  usePolling(pingSession, SESSION_PING_MS, authChecked && !isLoginPage && !suspended);

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
        const denial = await denialFrom(res);
        if (denial && "suspension" in denial) {
          setSuspended(denial.suspension);
          return;
        }
        // Sin sesión, o con la de otro negocio: al ingreso de este.
        router.replace(`/${slugOf(pathname)}/admin/login`);
      } else {
        const data = await res.json();
        // Por las dudas, aunque el servidor ya lo revisa: nunca pintar un negocio en la dirección de otro.
        if (String(data.tenantSlug ?? "").toLowerCase() !== slugOf(pathname).toLowerCase()) {
          router.replace(`/${slugOf(pathname)}/admin/login`);
          return;
        }
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
          planLimits: !!data.planLimits,
          tenantSlug: data.tenantSlug,
          tenantName: data.tenantName || pathname.split("/")[1],
          logoUrl: data.logoUrl || "",
          primaryColor: data.primaryColor || "",
        };
        if (s.role !== "admin" && !s.isPremium) {                 // tenant degradado con staff logueado
          await fetch("/api/admin/auth/logout", { method: "POST" });
          router.replace(`${base}/login`);
          return;
        }
        const feature = featureForPath(pathname, base);
        // Sin permiso por rol, o fuera del plan para quien no ve esas secciones con candado: al
        // inicio. El dueño de un negocio con límites sí entra y ve qué plan la incluye.
        if (feature && (!can(s, feature) || (!planAllows(s, feature) && !seesLockedSections(s)))) {
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
  // Lo que es igual para todos los negocios (el menú, el texto) va en el azul de Ennea; el color del
  // negocio, ajustado para que se lea, queda en las variables --admin-* (ver adminBrand.ts).
  // Antes de pintar: si no, el primer cuadro sale con los colores por defecto.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const gradient = `linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 50%, ${branding.accentColor} 100%)`;
    const vars: Record<string, string> = {
      "--color-brand-pink":   branding.primaryColor,
      "--color-brand-orange": branding.secondaryColor,
      "--color-brand-yellow": branding.accentColor,
      "--gradient-brand":     gradient,
      "--color-brand-dark":   ENNEA_COLORS.navy,
      ...adminBrandVars(branding.primaryColor),
    };
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [branding]);

  if (pathname.endsWith("/admin/login")) {
    return <div className="min-h-screen bg-brand-muted/20">{children}</div>;
  }

  // El servidor ya cerró la sesión; "Salir" lleva al ingreso, que también muestra la suspensión.
  if (suspended) {
    const slug = pathname.split("/")[1];
    return (
      <SuspendedScreen
        tenantName={session?.tenantName || branding.tenantName || slug}
        title={suspended.title}
        message={suspended.message}
        note={suspended.note}
        action={
          <button
            type="button"
            onClick={() => router.replace(`/${slug}/admin/login`)}
            className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 cursor-pointer"
          >
            Salir
          </button>
        }
      />
    );
  }

  // Pasando de un negocio a otro sin recargar, la sesión guardada puede ser la del anterior: no se
  // muestra mientras se vuelve a preguntar.
  if (!authChecked || !session || String(session.tenantSlug ?? "").toLowerCase() !== slugOf(pathname).toLowerCase()) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F6F7F9]">
        <p className="text-brand-dark/40 text-sm">Verificando sesión...</p>
      </div>
    );
  }

  const base = `/${pathname.split("/")[1]}/admin`;
  const feature = featureForPath(pathname, base);
  const lockedPlan = feature ? planNeededFor(session, feature) : null;
  const section = pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";
  const nav = visibleNav(session, base);
  const sidebarProps = {
    tenantName: branding.tenantName,
    logoUrl: branding.logoUrl,
    role: session.role,
    plan: session.plan,
    planLimits: session.planLimits,
    userName: session.name,
  };

  return (
    <AdminSessionProvider value={session}>
      {/* Dentro del provider de sesión y por fuera del layout: así el contador de comandas se pide
          una sola vez y lo leen tanto el menú (que se monta dos veces: escritorio y cajón) como la
          pantalla de turno. */}
      <PendingComandasProvider>
      <div className="flex h-screen overflow-hidden bg-[#F6F7F9]">
        {/* Desktop sidebar — el propio AdminSidebar maneja su altura y su scroll interno */}
        <div className="hidden lg:flex shrink-0 h-screen">
          <AdminSidebar {...sidebarProps} onSearch={() => setSearchOpen(true)} />
        </div>

        {/* Mobile/tablet sidebar drawer */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
              <AdminSidebar
                {...sidebarProps}
                onClose={() => setSidebarOpen(false)}
                onSearch={() => { setSidebarOpen(false); setSearchOpen(true); }}
              />
            </div>
          </>
        )}

        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile/tablet top bar */}
          <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-brand-dark shrink-0 z-30">
            <MobileMenuButton onOpen={() => setSidebarOpen(true)} />
            <p className="flex-1 min-w-0 font-brand text-lg font-bold text-white truncate">{branding.tenantName}</p>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Buscar en el panel"
            >
              <Search className="w-5 h-5" />
            </button>
          </header>

          <AdminTopBar nav={nav} base={base} role={session.role} />

          <TenantNotices />

          <main className="flex-1 overflow-y-auto">
            {lockedPlan ? (
              <PlanLockedScreen
                section={SECTION_LABELS[section] ?? "Esta sección"}
                plan={lockedPlan}
                currentPlan={session.plan}
                tenantName={session.tenantName}
                homeHref={homePathFor(session.role, base)}
              />
            ) : children}
          </main>
        </div>

        <ReminderToast />
        <AdminCommand open={searchOpen} onClose={() => setSearchOpen(false)} nav={nav} base={base} />
        {sessionExpired && (
          <SessionExpiredDialog
            onLogin={() => { setSessionExpired(false); router.replace(`/${slugOf(pathname)}/admin/login`); }}
          />
        )}
      </div>
      </PendingComandasProvider>
    </AdminSessionProvider>
  );
}
