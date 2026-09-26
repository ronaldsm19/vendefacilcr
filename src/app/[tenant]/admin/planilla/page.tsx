"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, Clock3, HandCoins, AlertTriangle, Pencil, Loader2 } from "lucide-react";
import { useAdminSession } from "@/components/admin/SessionContext";
import StatsCard from "@/components/admin/StatsCard";
import PeriodPicker from "@/components/admin/jornada/PeriodPicker";
import PayRateDialog from "@/components/admin/planilla/PayRateDialog";
import PayDialog from "@/components/admin/planilla/PayDialog";
import StaffPayrollDetail from "@/components/admin/planilla/StaffPayrollDetail";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";
import { nowInCR, resolvePeriod, formatHoursMinutes, type PeriodType } from "@/lib/workPeriod";
import { payRateLabel, type PayrollOverview, type PayrollRow } from "@/lib/payroll";

/**
 * Planilla: cuánto se le debe a cada persona, qué ya se le pagó y el registro de cada pago.
 *
 * Es un control interno, no una planilla legal: no calcula CCSS ni liquida aguinaldo, y el
 * comprobante que genera no es un documento tributario. Está dicho también en el pie de la
 * pantalla para que nadie lo confunda.
 */

function money(n: number) {
  return `₡${Math.round(n).toLocaleString("es-CR")}`;
}

export default function PlanillaPage() {
  const { isPremium } = useAdminSession();
  const [periodType, setPeriodType] = useState<PeriodType>("quincena");
  const [periodRef, setPeriodRef] = useState<Date>(() => nowInCR());
  const [data, setData] = useState<PayrollOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rateTarget, setRateTarget] = useState<PayrollRow | null>(null);
  const [payTarget, setPayTarget] = useState<PayrollRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<PayrollRow | null>(null);

  const load = useCallback(async () => {
    if (!isPremium) {
      setLoading(false);
      return;
    }
    const { from, to } = resolvePeriod(periodType, periodRef);
    try {
      const res = await fetch(
        `/api/admin/payroll?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo cargar la planilla");
      setData(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la planilla");
    }
  }, [isPremium, periodType, periodRef]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (!isPremium) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
          La planilla está disponible en el plan Premium.
        </div>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark flex items-center gap-2">
            <Wallet className="w-6 h-6 text-brand-pink" /> Planilla
          </h1>
          <p className="text-brand-dark/50 text-sm mt-1">
            Lo que se le debe a cada persona según las horas que marcó, y el registro de cada pago.
          </p>
        </div>
        <PeriodPicker
          type={periodType}
          refCR={periodRef}
          onTypeChange={setPeriodType}
          onRefChange={setPeriodRef}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard label="Pendiente de pago" value={money(totals?.due ?? 0)} icon={HandCoins} color="pink"
          sub="De todo el tiempo, no solo del período" />
        <StatsCard label="Horas sin pagar" value={formatHoursMinutes(totals?.unpaidMinutes ?? 0)} icon={Clock3} color="orange" />
        <StatsCard label="Pagado en el período" value={money(totals?.paidInPeriod ?? 0)} icon={Wallet} color="green" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-brand-dark/40">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-8 text-center text-brand-dark/40">
          Todavía no hay personal activo. Agregalo desde Usuarios.
        </div>
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden md:block bg-white rounded-2xl card-shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-dark/40 uppercase border-b border-brand-muted">
                  <th className="text-left px-5 py-3">Persona</th>
                  <th className="text-right px-5 py-3">Horas del período</th>
                  <th className="text-right px-5 py-3">Horas sin pagar</th>
                  <th className="text-left px-5 py-3">Tarifa</th>
                  <th className="text-right px-5 py-3">Se le debe</th>
                  <th className="text-left px-5 py-3">Último pago</th>
                  <th className="text-right px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.staffUserId} className="border-b border-brand-muted/60 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-brand-dark">{r.name}</p>
                      <p className="text-xs text-brand-dark/40">{ROLE_LABELS[r.role]}</p>
                      {r.openShifts > 0 && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> Turno sin cerrar
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-brand-dark/70">
                      {formatHoursMinutes(r.periodMinutes)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-brand-dark">
                      {formatHoursMinutes(r.unpaidMinutes)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={r.pay.rate <= 0 ? "text-amber-600" : "text-brand-dark/70"}>
                        {payRateLabel(r.pay)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold text-brand-pink">
                      {money(r.dueAmount)}
                    </td>
                    <td className="px-5 py-3 text-brand-dark/60 text-xs">
                      {r.lastPayment
                        ? `${new Date(r.lastPayment.paidAt).toLocaleDateString("es-CR")} · ${money(r.lastPayment.total)}`
                        : "Nunca"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Tarifa y teléfono"
                          onClick={() => setRateTarget(r)}
                          className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/50 hover:text-brand-dark transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <Button size="sm" variant="secondary" onClick={() => setDetailTarget(r)}>Detalle</Button>
                        <Button size="sm" disabled={r.unpaidMinutes === 0 || r.pay.rate <= 0} onClick={() => setPayTarget(r)}>
                          Pagar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teléfono */}
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div key={r.staffUserId} className="bg-white rounded-2xl card-shadow p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-dark truncate">{r.name}</p>
                    <p className="text-xs text-brand-dark/40">{ROLE_LABELS[r.role]}</p>
                  </div>
                  <p className="text-lg font-bold text-brand-pink shrink-0">{money(r.dueAmount)}</p>
                </div>

                {r.openShifts > 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Tiene un turno sin cerrar: esas horas no cuentan todavía
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-brand-dark/40">Sin pagar</p>
                    <p className="font-semibold text-brand-dark">{formatHoursMinutes(r.unpaidMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-brand-dark/40">Tarifa</p>
                    <p className={r.pay.rate <= 0 ? "text-amber-600 font-medium" : "text-brand-dark/70"}>
                      {payRateLabel(r.pay)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setRateTarget(r)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Tarifa
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDetailTarget(r)}>
                    Detalle
                  </Button>
                  <Button size="sm" className="flex-1" disabled={r.unpaidMinutes === 0 || r.pay.rate <= 0}
                    onClick={() => setPayTarget(r)}>
                    Pagar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-brand-dark/40">
        Control interno de pagos. No calcula CCSS ni liquida aguinaldo, y los comprobantes que genera
        no son facturas electrónicas ni documentos tributarios.
      </p>

      {rateTarget && (
        <PayRateDialog
          row={rateTarget}
          onClose={() => setRateTarget(null)}
          onSaved={() => { setRateTarget(null); load(); }}
        />
      )}

      {payTarget && (
        <PayDialog
          row={payTarget}
          period={resolvePeriod(periodType, periodRef)}
          onClose={() => setPayTarget(null)}
          onSaved={() => { setPayTarget(null); load(); }}
        />
      )}

      {detailTarget && (
        <StaffPayrollDetail
          row={detailTarget}
          onClose={() => setDetailTarget(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
