"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import SuperadminSidebar, { SuperadminBrand } from "@/components/superadmin/SuperadminSidebar";
import SuperadminEnvBar from "@/components/superadmin/SuperadminEnvBar";
import SuperadminCommand from "@/components/superadmin/SuperadminCommand";

export default function SuperadminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Para qué ruta ya se confirmó la sesión: al navegar se vuelve a comprobar.
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const isLogin = pathname === "/superadmin/login";

  // Guardia de sesión (la página de ingreso no la necesita).
  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    fetch("/api/superadmin/auth/me").then((res) => {
      if (cancelled) return;
      if (res.status === 401) router.replace("/superadmin/login");
      else setCheckedPath(pathname);
    }).catch(() => {
      if (!cancelled) router.replace("/superadmin/login");
    });
    return () => { cancelled = true; };
  }, [pathname, router, isLogin]);

  // Ctrl+K (o Cmd+K) abre el buscador desde cualquier pantalla.
  useEffect(() => {
    if (isLogin) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLogin]);

  if (isLogin) return <div className="min-h-screen flex flex-col">{children}</div>;

  // La primera vez se espera la comprobación; después, al navegar, se deja la pantalla puesta.
  if (checkedPath === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="sa-muted text-sm">Verificando sesión...</p>
      </div>
    );
  }

  const openSearch = () => { setSidebarOpen(false); setSearchOpen(true); };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <SuperadminEnvBar />

      <div className="flex flex-1 min-h-0">
        {/* Menú fijo en escritorio */}
        <div className="hidden md:flex shrink-0">
          <SuperadminSidebar onSearch={openSearch} />
        </div>

        {/* Menú como cajón en celular */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(20,23,28,0.45)" }} onClick={() => setSidebarOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 md:hidden" style={{ boxShadow: "var(--sa-shadow-modal)" }}>
              <SuperadminSidebar onClose={() => setSidebarOpen(false)} onSearch={openSearch} />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Barra superior en celular */}
          <header className="md:hidden shrink-0 flex items-center gap-3 px-4 py-2.5" style={{ background: "var(--sa-surface)", borderBottom: "1px solid var(--sa-line)" }}>
            <button onClick={() => setSidebarOpen(true)} className="sa-icon-btn" aria-label="Abrir menú">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0"><SuperadminBrand /></div>
            <button onClick={openSearch} className="sa-icon-btn" aria-label="Buscar">
              <Search className="w-5 h-5" />
            </button>
          </header>

          <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
        </div>
      </div>

      <SuperadminCommand open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
