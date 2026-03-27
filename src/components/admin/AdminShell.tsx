"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

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
    fetch("/api/admin/auth/me").then((res) => {
      if (res.status === 401) {
        const tenant = pathname.split("/")[1];
        router.replace(`/${tenant}/admin/login`);
      } else {
        setAuthChecked(true);
      }
    }).catch(() => {
      const tenant = pathname.split("/")[1];
      router.replace(`/${tenant}/admin/login`);
    });
  }, [pathname, router]);

  if (pathname.endsWith("/admin/login")) {
    return <div className="min-h-screen bg-brand-muted/20">{children}</div>;
  }

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#F8F0F5" }}>
        <p className="text-brand-dark/30 text-sm">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-muted/20">
      {/* Desktop sidebar — fixed height, scrolls internally if needed */}
      <div className="hidden md:flex shrink-0 h-screen overflow-y-auto">
        <AdminSidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Content area — scrolls independently of the sidebar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-brand-dark shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-brand text-lg font-bold gradient-text">Dulce Pecado</p>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
