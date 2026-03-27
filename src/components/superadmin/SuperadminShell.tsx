"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Zap } from "lucide-react";
import SuperadminSidebar from "@/components/superadmin/SuperadminSidebar";

export default function SuperadminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (pathname === "/superadmin/login") {
    return (
      <div className="min-h-screen" style={{ background: "#06060A" }}>
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#06060A" }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0 h-screen overflow-y-auto">
        <SuperadminSidebar />
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <SuperadminSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header
          className="md:hidden flex items-center gap-3 px-4 py-3 shrink-0 z-30"
          style={{ background: "#0D0D14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Zap className="w-4 h-4 text-blue-400" />
          <p className="font-brand text-lg font-bold saas-accent-text">VendeFácil</p>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: "#06060A" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
