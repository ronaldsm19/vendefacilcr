import type { SectionTotal } from "@/lib/sections";

/**
 * Ventas por sección del negocio (Cafetería, Tienda…). Suma las líneas vendidas, sin IVA, servicio,
 * propina ni envío, así que el total puede ser menor que los ingresos de la pantalla.
 */
export default function SectionSalesCard({
  totals,
  title = "Ventas por sección",
  compact = false,
}: {
  totals: SectionTotal[];
  title?: string;
  /** Estilo de las tarjetas del cierre de caja (borde, menos relleno) en vez del de finanzas. */
  compact?: boolean;
}) {
  const grand = totals.reduce((s, t) => s + t.revenue, 0);

  return (
    <div className={compact ? "bg-white rounded-2xl border border-brand-muted p-4" : "bg-white rounded-2xl card-shadow p-6"}>
      <h2 className="font-semibold text-brand-dark">{title}</h2>
      <p className="text-xs text-brand-dark/45 mt-0.5 mb-4">
        Lo vendido en productos de cada sección, sin IVA, servicio, propina ni envío.
      </p>
      <div className="space-y-3">
        {totals.map((t) => {
          const pct = grand > 0 ? Math.round((t.revenue / grand) * 100) : 0;
          return (
            <div key={t.sectionId}>
              <div className="flex justify-between gap-2 text-sm mb-1">
                <span className="text-brand-dark font-medium truncate">{t.name}</span>
                <span className="text-brand-dark/60 shrink-0">
                  ₡{Math.round(t.revenue).toLocaleString("es-CR")} · {t.units} {t.units === 1 ? "unidad" : "unidades"} · {pct}%
                </span>
              </div>
              <div className="h-2 bg-brand-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full gradient-bg" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="flex justify-between text-sm pt-2 border-t border-brand-muted">
          <span className="font-semibold text-brand-dark">Total en productos</span>
          <span className="font-semibold text-brand-dark">₡{Math.round(grand).toLocaleString("es-CR")}</span>
        </div>
      </div>
    </div>
  );
}
