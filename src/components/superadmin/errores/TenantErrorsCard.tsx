"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, TriangleAlert } from "lucide-react";

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
    <section className="sa-card sa-card-pad flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="sa-h2">Errores · últimos 7 días</h2>
        {failed ? (
          <p className="sa-error mt-1.5" role="alert">No se pudieron cargar los errores.</p>
        ) : !summary ? (
          <p className="sa-muted mt-1.5">Cargando...</p>
        ) : summary.errores + summary.avisos === 0 ? (
          <p className="mt-2">
            <span className="sa-chip sa-chip-ok"><Check aria-hidden />Sin errores ni avisos</span>
          </p>
        ) : (
          <>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`sa-chip ${summary.errores > 0 ? "sa-chip-danger" : ""}`}>
                <CircleAlert aria-hidden />
                <span className="sa-num">{summary.errores}</span> {summary.errores === 1 ? "error" : "errores"}
              </span>
              <span className={`sa-chip ${summary.avisos > 0 ? "sa-chip-warn" : ""}`}>
                <TriangleAlert aria-hidden />
                <span className="sa-num">{summary.avisos}</span> {summary.avisos === 1 ? "aviso" : "avisos"}
              </span>
            </p>
            {summary.apiTop && (
              <p className="sa-muted mt-2 text-[13px] [overflow-wrap:anywhere]">
                La que más falla: <span className="sa-mono">{summary.apiTop}</span>
              </p>
            )}
          </>
        )}
      </div>
      <Link href={`/superadmin/errores?negocio=${encodeURIComponent(tenantId)}`} className="sa-btn sa-btn-secondary">
        Ver en Errores <ArrowRight className="w-4 h-4" aria-hidden />
      </Link>
    </section>
  );
}
