"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bug } from "lucide-react";

interface Summary {
  errores: number;
  avisos: number;
  apiTop: string | null;
  ultimo: string | null;
}

/** Ficha del negocio: sus errores y avisos de los últimos 7 días, con enlace al panel filtrado. */
export default function TenantErrorsCard({ tenantId }: { tenantId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/superadmin/errores?periodo=7d&negocio=${encodeURIComponent(tenantId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        const api = d.porApi?.[0];
        setSummary({
          errores: d.resumen?.errores ?? 0,
          avisos: d.resumen?.avisos ?? 0,
          apiTop: api ? `${api._id.method} ${api._id.route}` : null,
          ultimo: d.ultimos?.[0]?.lastAt ?? null,
        });
      })
      .catch(() => setFailed(true));
  }, [tenantId]);

  return (
    <div className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-start gap-3 min-w-0">
        <Bug className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-white/70 font-semibold text-sm uppercase tracking-wide">Errores · últimos 7 días</h2>
          {failed ? (
            <p className="text-red-300 text-sm mt-1">No se pudieron cargar los errores.</p>
          ) : !summary ? (
            <p className="text-white/30 text-sm mt-1">Cargando...</p>
          ) : summary.errores + summary.avisos === 0 ? (
            <p className="text-white/40 text-sm mt-1">Sin errores ni avisos.</p>
          ) : (
            <p className="text-sm mt-1 text-white/60">
              <span className="text-red-300 font-semibold">{summary.errores} errores</span>
              {" · "}
              <span className="text-amber-300 font-semibold">{summary.avisos} avisos</span>
              {summary.apiTop && <span className="block font-mono text-xs text-white/40 truncate">La que más falla: {summary.apiTop}</span>}
            </p>
          )}
        </div>
      </div>
      <Link
        href={`/superadmin/errores?negocio=${encodeURIComponent(tenantId)}`}
        className="text-sm text-white/60 hover:text-white px-3 py-2 rounded-xl transition-colors"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        Ver en Errores →
      </Link>
    </div>
  );
}
