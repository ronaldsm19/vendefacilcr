"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCRC } from "@/lib/billing";
import type { OwnerStatus } from "@/lib/mensualidad";
import { PAYMENT_STATE } from "@/components/superadmin/pagos/paymentStatus";

interface Grid {
  periods: { key: number; label: string; title: string }[];
  rows: {
    id: string;
    name: string;
    slug: string;
    status: string;
    cells: ({ id: string; status: OwnerStatus; amount: number } | null)[];
  }[];
}

const LEGEND: OwnerStatus[] = ["verificado", "revision", "pendiente", "atrasada", "rechazado", "sin_costo", "anulada"];

/**
 * Negocios por meses: de un vistazo, quién pagó cada mes. Cada celda abre la revisión de ese mes.
 * `reloadKey` cambia cuando se aprueba o rechaza algo, para volver a pedir la cuadrícula.
 */
export default function PaymentsGrid({ onOpen, reloadKey, query }: { onOpen: (id: string) => void; reloadKey: number; query: string }) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  // Los meses van del más viejo al más nuevo: arranca mostrando los últimos (el mes actual a la derecha).
  useEffect(() => {
    if (grid && wrap.current) wrap.current.scrollLeft = wrap.current.scrollWidth;
  }, [grid]);

  useEffect(() => {
    let alive = true;
    fetch("/api/superadmin/pagos/cuadricula?meses=12")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) { setGrid(d); setError(""); } else setError(d.error ?? "No se pudo cargar la cuadrícula");
      })
      .catch(() => alive && setError("Error de red"));
    return () => { alive = false; };
  }, [reloadKey]);

  if (error) return <p className="sa-alert sa-alert-danger" role="alert">{error}</p>;
  if (!grid) return <div className="sa-card sa-empty">Cargando...</div>;

  const q = query.trim().toLowerCase();
  const rows = q ? grid.rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q)) : grid.rows;

  return (
    <section className="sa-card overflow-hidden" aria-label="Mensualidades por negocio y mes">
      {rows.length === 0 ? (
        <div className="sa-empty">Ningún negocio coincide con la búsqueda.</div>
      ) : (
        <div className="sa-table-wrap" ref={wrap}>
          <table className="sa-table">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-[1] bg-[var(--sa-surface)]">Negocio</th>
                {grid.periods.map((p) => (
                  <th key={p.key} scope="col" className="text-center whitespace-nowrap" title={p.title}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="sticky left-0 z-[1] bg-[var(--sa-surface)] text-left font-normal">
                    <Link href={`/superadmin/tenants/${r.id}`} className="block min-w-[150px]">
                      <span className="sa-strong block">{r.name}</span>
                      {r.status !== "active" && <span className="sa-muted text-xs">{r.status === "suspended" ? "Suspendido" : "Inactivo"}</span>}
                    </Link>
                  </th>
                  {r.cells.map((c, i) => {
                    const period = grid.periods[i];
                    if (!c) return <td key={period.key} className="text-center sa-muted" aria-label={`${period.title}: sin factura`}>·</td>;
                    const s = PAYMENT_STATE[c.status];
                    const Icon = s.icon;
                    return (
                      <td key={period.key} className="text-center">
                        <button
                          type="button"
                          onClick={() => onOpen(c.id)}
                          className={`${s.className} cursor-pointer !px-1.5`}
                          title={`${period.title}: ${s.label} · ${formatCRC(c.amount)}`}
                          aria-label={`${r.name}, ${period.title}: ${s.label}, ${formatCRC(c.amount)}`}
                        >
                          <Icon aria-hidden />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--sa-line)] px-5 py-3">
        {LEGEND.map((k) => {
          const s = PAYMENT_STATE[k];
          const Icon = s.icon;
          return <span key={k} className={s.className}><Icon aria-hidden />{s.label}</span>;
        })}
        <span className="sa-muted text-xs">· sin factura</span>
      </div>
    </section>
  );
}
