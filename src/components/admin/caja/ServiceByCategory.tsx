"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface CategoryRow { category: string; total: number; exempt: number }

/**
 * A qué se le cobra el servicio: un interruptor por categoría de productos. Apagarlo marca todos
 * los productos de esa categoría como "no cobra servicio" (lo de la tienda, por ejemplo); para un
 * producto suelto está la casilla en su ficha. Se guarda al tocar, sin botón.
 */
export default function ServiceByCategory({ rate }: { rate: number }) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/products/bulk-service")
      .then((r) => r.json())
      .then((d) => { if (alive) setRows(d.categories ?? []); })
      .catch(() => { if (alive) setError("No se pudieron cargar las categorías"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function toggle(row: CategoryRow, charges: boolean) {
    setSavingCategory(row.category);
    setError("");
    try {
      const res = await fetch("/api/admin/products/bulk-service", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: row.category, charges }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "No se pudo guardar"); return; }
      setRows((prev) => prev.map((r) => (r.category === row.category ? { ...r, exempt: charges ? 0 : r.total } : r)));
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-brand-dark text-lg">¿A qué se le cobra el servicio?</h2>
        <p className="text-sm text-brand-dark/50 mt-0.5">
          El {rate}% se calcula solo sobre los productos de las categorías encendidas. Apagá las que se venden sin
          atención en mesa, como la tienda. Se guarda al tocar. Para un producto en particular, usá la casilla
          &quot;Cobra 10% de servicio&quot; en su ficha.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-brand-dark/40">Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-brand-dark/40">Todavía no hay productos.</p>
      ) : (
        <ul className="divide-y divide-brand-muted/60">
          {rows.map((r) => {
            const charges = r.exempt === 0;
            const mixed = r.exempt > 0 && r.exempt < r.total;
            const saving = savingCategory === r.category;
            return (
              <li key={r.category} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-dark truncate">{r.category || "Sin categoría"}</p>
                  <p className="text-xs text-brand-dark/50">
                    {mixed
                      ? `${r.total - r.exempt} de ${r.total} productos lo cobran`
                      : charges
                        ? `${r.total} producto${r.total === 1 ? "" : "s"} · cobran servicio`
                        : `${r.total} producto${r.total === 1 ? "" : "s"} · sin servicio`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {saving && <Loader2 className="w-4 h-4 animate-spin text-brand-pink" aria-hidden />}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={charges}
                    aria-label={`Cobrar servicio en ${r.category || "productos sin categoría"}`}
                    disabled={saving}
                    onClick={() => toggle(r, !charges)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-pink focus:ring-offset-2 disabled:opacity-60 ${
                      charges ? "gradient-bg" : mixed ? "bg-amber-300" : "bg-brand-muted"
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${charges ? "translate-x-6" : mixed ? "translate-x-3.5" : "translate-x-1"}`} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2" role="alert">{error}</p>}
    </section>
  );
}
