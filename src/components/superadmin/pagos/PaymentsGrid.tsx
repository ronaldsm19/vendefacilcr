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
    /** Desde qué mes existe el negocio (aaaamm). */
    since: number;
    cells: ({ id: string; status: OwnerStatus; amount: number } | null)[];
  }[];
}

const LEGEND: OwnerStatus[] = ["verificado", "revision", "pendiente", "atrasada", "rechazado", "sin_costo", "anulada"];

/**
 * Negocios por meses: de un vistazo, quién pagó cada mes. Cada celda abre la revisión de ese mes, y
 * un mes sin factura (desde que existe el negocio) se puede crear desde su celda: sale con el cobro
 * que tenga el negocio en su ficha, así que una cortesía que cubre ese mes la deja sin costo.
 * `reloadKey` cambia cuando se aprueba o rechaza algo, para volver a pedir la cuadrícula.
 */
export default function PaymentsGrid({ onOpen, reloadKey, query }: { onOpen: (id: string) => void; reloadKey: number; query: string }) {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState("");
  const [bump, setBump] = useState(0);
  const [creating, setCreating] = useState("");
  const [cellError, setCellError] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  // Los meses van del más viejo al más nuevo: arranca mostrando los últimos (el mes actual a la derecha).
  // Solo la primera vez, para no mover la tabla cada vez que se crea un mes.
  useEffect(() => {
    if (grid && wrap.current && !scrolled.current) {
      wrap.current.scrollLeft = wrap.current.scrollWidth;
      scrolled.current = true;
    }
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
  }, [reloadKey, bump]);

  async function createInvoice(row: Grid["rows"][number], period: Grid["periods"][number]) {
    if (!confirm(`¿Crear la mensualidad de ${period.title} para ${row.name}?\n\nSe calcula con el cobro que tiene hoy en su ficha: si ese mes le queda dentro de una cortesía, se crea sin costo; si no, queda pendiente con el precio de su plan.`)) return;
    setCreating(`${row.id}:${period.key}`);
    setCellError("");
    try {
      const res = await fetch("/api/superadmin/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: row.id, year: Math.floor(period.key / 100), month: period.key % 100 }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setBump((b) => b + 1);
      else setCellError(d.error ?? "No se pudo crear la mensualidad");
    } catch {
      setCellError("Error de red: no se creó la mensualidad");
    } finally {
      setCreating("");
    }
  }

  if (error) return <p className="sa-alert sa-alert-danger" role="alert">{error}</p>;
  if (!grid) return <div className="sa-card sa-empty">Cargando...</div>;

  const q = query.trim().toLowerCase();
  const rows = q ? grid.rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q)) : grid.rows;

  return (
    <section className="sa-card overflow-hidden" aria-label="Mensualidades por negocio y mes">
      {cellError && <p className="sa-alert sa-alert-danger m-4" role="alert">{cellError}</p>}
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
                    if (!c) {
                      if (period.key < r.since) return <td key={period.key} className="text-center" aria-label={`${period.title}: el negocio todavía no existía`} />;
                      const busy = creating === `${r.id}:${period.key}`;
                      return (
                        <td key={period.key} className="text-center">
                          <button
                            type="button"
                            onClick={() => void createInvoice(r, period)}
                            disabled={Boolean(creating)}
                            className="sa-muted cursor-pointer rounded px-2 py-0.5 hover:bg-[var(--sa-line)] disabled:cursor-wait"
                            title={`${period.title}: sin factura. Tocá para crearla`}
                            aria-label={`${r.name}, ${period.title}: sin factura. Crear la mensualidad`}
                          >
                            {busy ? "…" : "·"}
                          </button>
                        </td>
                      );
                    }
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
        <span className="sa-muted text-xs">· sin factura (tocalo para crearla)</span>
      </div>
    </section>
  );
}
