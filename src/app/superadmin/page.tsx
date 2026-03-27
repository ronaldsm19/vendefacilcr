"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, AlertTriangle, ClipboardList, TrendingUp } from "lucide-react";

interface DashboardData {
  totalTenants: number;
  activeTenants: number;
  morososCount: number;
  pendingRequests: number;
  revenueThisMonth: number;
}

function KPICard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string | number; icon: React.ElementType;
  color: "blue" | "green" | "red" | "yellow" | "purple"; sub?: string;
}) {
  const palette = {
    blue:   { bg: "rgba(59,130,246,0.1)",   text: "text-blue-400",   border: "rgba(59,130,246,0.2)"   },
    green:  { bg: "rgba(16,185,129,0.1)",   text: "text-emerald-400",border: "rgba(16,185,129,0.2)"   },
    red:    { bg: "rgba(239,68,68,0.1)",    text: "text-red-400",    border: "rgba(239,68,68,0.2)"    },
    yellow: { bg: "rgba(245,158,11,0.1)",   text: "text-amber-400",  border: "rgba(245,158,11,0.2)"   },
    purple: { bg: "rgba(147,51,234,0.1)",   text: "text-purple-400", border: "rgba(147,51,234,0.2)"   },
  }[color];

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
      >
        <Icon className={`w-5 h-5 ${palette.text}`} />
      </div>
      <p className={`text-2xl font-bold ${palette.text}`}>{value}</p>
      <p className="text-white/60 text-sm mt-1 font-medium">{label}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export default function SuperadminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/superadmin/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const mes = now.toLocaleString("es-CR", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-white/30">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1 capitalize">{mes}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard label="Total tenants"    value={data?.totalTenants ?? 0}   icon={Building2}     color="blue"   sub="Registrados" />
        <KPICard label="Tenants activos"  value={data?.activeTenants ?? 0}  icon={CheckCircle2}  color="green"  sub="Activos ahora" />
        <KPICard
          label="Ingresos del mes"
          value={`₡${(data?.revenueThisMonth ?? 0).toLocaleString("es-CR")}`}
          icon={TrendingUp} color="purple"
          sub="Pagos recibidos"
        />
        <KPICard label="Solicitudes"      value={data?.pendingRequests ?? 0} icon={ClipboardList} color="yellow" sub="Pendientes de revisión" />
        <KPICard label="Morosos"          value={data?.morososCount ?? 0}   icon={AlertTriangle}  color="red"    sub="Pagos atrasados" />
      </div>

      <div
        className="rounded-2xl p-6"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <h2 className="text-white/70 font-semibold mb-3 text-sm uppercase tracking-wide">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Ver solicitudes pendientes", href: "/superadmin/solicitudes" },
            { label: "Generar facturas del mes",    href: "/superadmin/pagos" },
            { label: "Ver todos los tenants",       href: "/superadmin/tenants" },
            { label: "Actividad reciente",          href: "/superadmin/actividad" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
