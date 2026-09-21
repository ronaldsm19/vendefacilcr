"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, Clock3, Receipt } from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
import PeriodPicker from "@/components/admin/jornada/PeriodPicker";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { nowInCR, resolvePeriod, formatHoursMinutes, type PeriodType } from "@/lib/workPeriod";

interface Worker {
  staffUserId: string;
  name: string;
  role: Role;
  minutes: number;
  share: number;
  amount: number;
}

interface ServiceReportData {
  serviceTotal: number;
  salesCount: number;
  totalMinutes: number;
  workers: Worker[];
}

/** Sección de Finanzas: cuánto le toca a cada trabajador del 10% de servicio, según sus
 * horas marcadas en Jornada laboral en el mismo período. Solo lee ventas y turnos —no
 * modifica nada del cálculo de finanzas existente. */
export default function ServiceReportSection() {
  const [periodType, setPeriodType] = useState<PeriodType>("quincena");
  const [periodRef, setPeriodRef] = useState<Date>(() => nowInCR());
  const [data, setData] = useState<ServiceReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { from, to } = resolvePeriod(periodType, periodRef);
    const res = await fetch(
      `/api/admin/service-report?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
    );
    if (res.ok) setData(await res.json());
  }, [periodType, periodRef]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + refetch al cambiar de período, mismo patrón ya presente en el resto de Finanzas
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const sumAmounts = data?.workers.reduce((a, w) => a + w.amount, 0) ?? 0;

  return (
    <div className="bg-white rounded-2xl card-shadow p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-brand-dark">Reparto del 10% por horas trabajadas</h2>
          <p className="text-brand-dark/50 text-xs mt-0.5">El reparto es proporcional a las horas trabajadas en el período.</p>
        </div>
        <PeriodPicker type={periodType} refCR={periodRef} onTypeChange={setPeriodType} onRefChange={setPeriodRef} />
      </div>

      {loading ? (
        <p className="text-sm text-brand-dark/40 mt-6">Cargando reparto...</p>
      ) : !data ? (
        <p className="text-sm text-red-600 mt-6">No se pudo cargar el reparto.</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard label="Total del 10% generado" value={`₡${data.serviceTotal.toLocaleString("es-CR")}`} icon={DollarSign} color="green" />
            <StatsCard label="Horas del equipo" value={formatHoursMinutes(data.totalMinutes)} icon={Clock3} color="pink" />
            <StatsCard label="Ventas que lo cobraron" value={data.salesCount} icon={Receipt} color="yellow" />
          </div>

          {data.totalMinutes === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              No hay horas de personal registradas en este período — no hay nada que repartir todavía.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {data.workers.map((w) => (
                  <div key={w.staffUserId} className="flex items-center justify-between gap-3 border border-brand-muted rounded-xl p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-dark truncate">{w.name}</p>
                      <p className="text-xs text-brand-dark/40">
                        {ROLE_LABELS[w.role]} · {formatHoursMinutes(w.minutes)} · {Math.round(w.share * 100)}%
                      </p>
                    </div>
                    <p className="text-lg font-bold text-brand-pink shrink-0">₡{w.amount.toLocaleString("es-CR")}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-brand-muted text-sm">
                <span className="text-brand-dark/50">Suma de los montos repartidos</span>
                <span className="font-semibold text-brand-dark">₡{sumAmounts.toLocaleString("es-CR")}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
