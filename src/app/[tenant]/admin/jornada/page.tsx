"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, AlertTriangle, ShieldCheck, Pencil } from "lucide-react";
import { useAdminSession } from "@/components/admin/SessionContext";
import { usePolling } from "@/hooks/usePolling";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { nowInCR, resolvePeriod, formatHoursMinutes, type PeriodType } from "@/lib/workPeriod";
import StaffPicker, { type ActiveStaffEntry } from "@/components/admin/jornada/StaffPicker";
import PeriodPicker from "@/components/admin/jornada/PeriodPicker";
import CloseStuckShiftDialog, { type StuckShift } from "@/components/admin/jornada/CloseStuckShiftDialog";
import { Button } from "@/components/ui/button";

const DESKTOP_MESSAGE = "El marcaje de jornada solo se puede hacer desde la computadora del negocio";
const SIXTEEN_HOURS_MS = 16 * 60 * 60 * 1000;

interface ShiftRow {
  _id: string;
  staffUserId: string;
  staffName: string;
  staffRole: Role;
  startedAt: string;
  endedAt: string | null;
  minutes: number;
  status: "abierta" | "cerrada";
  closedBy: "staff" | "admin";
  adjustedByName: string;
  adjustNote: string;
}

interface TotalRow {
  staffUserId: string;
  name: string;
  role: Role;
  minutes: number;
  shiftsCount: number;
  openCount: number;
}

interface HoursData {
  shifts: ShiftRow[];
  totals: TotalRow[];
  openShifts: StuckShift[];
}

function useIsSmallScreen(): boolean {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return small;
}

export default function JornadaPage() {
  const session = useAdminSession();
  const isSmallScreen = useIsSmallScreen();
  const isAdmin = session.role === "admin";

  // ── Personal activo + marcaje ─────────────────────────────────────────────
  const [staff, setStaff] = useState<ActiveStaffEntry[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [marcajeError, setMarcajeError] = useState("");
  const [marcajeBusy, setMarcajeBusy] = useState(false);

  const loadActive = useCallback(async () => {
    const res = await fetch("/api/admin/work-shifts/active");
    if (!res.ok) return;
    const data = await res.json();
    setStaff(data.staff ?? []);
    setStaffLoaded(true);
  }, []);

  usePolling(loadActive, 30000, true);

  const selectedStaff = staff.find((s) => s._id === selectedStaffId) ?? null;

  async function handleMarcaje() {
    if (!selectedStaff || pin.length !== 4) return;
    setMarcajeBusy(true);
    setMarcajeError("");
    const endpoint = selectedStaff.openShift ? "stop" : "start";
    try {
      const res = await fetch(`/api/admin/work-shifts/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffUserId: selectedStaff._id, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMarcajeError(data.error ?? "No se pudo completar la acción");
      } else {
        await loadActive();
        if (isAdmin) await loadHours();
      }
    } catch {
      setMarcajeError("No se pudo conectar. Revisá tu conexión.");
    } finally {
      setPin("");
      setMarcajeBusy(false);
    }
  }

  // ── Temporizador en vivo: re-renderiza cada segundo para que los contadores avancen ──
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const nowMs = Date.now();

  const working = staff.filter((s): s is ActiveStaffEntry & { openShift: NonNullable<ActiveStaffEntry["openShift"]> } => !!s.openShift);

  // ── Horas acumuladas (solo admin) ─────────────────────────────────────────
  const [periodType, setPeriodType] = useState<PeriodType>("quincena");
  const [periodRef, setPeriodRef] = useState<Date>(() => nowInCR());
  const [hoursData, setHoursData] = useState<HoursData | null>(null);
  const [hoursLoading, setHoursLoading] = useState(true);
  const [closingShift, setClosingShift] = useState<StuckShift | null>(null);

  const loadHours = useCallback(async () => {
    const { from, to } = resolvePeriod(periodType, periodRef);
    const res = await fetch(`/api/admin/work-shifts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
    if (!res.ok) return;
    const data = await res.json();
    setHoursData(data);
  }, [periodType, periodRef]);

  useEffect(() => {
    if (!isAdmin) return;
    setHoursLoading(true);
    loadHours().finally(() => setHoursLoading(false));
  }, [isAdmin, loadHours]);

  const maxMinutes = Math.max(1, ...(hoursData?.totals.map((t) => t.minutes) ?? [0]));
  const adjustedStaffIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of hoursData?.shifts ?? []) {
      if (s.closedBy === "admin") ids.add(s.staffUserId);
    }
    return ids;
  }, [hoursData]);

  const stuckShifts = (hoursData?.openShifts ?? []).filter(
    (s) => nowMs - new Date(s.startedAt).getTime() > SIXTEEN_HOURS_MS
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark flex items-center gap-2">
          <Clock className="w-6 h-6 text-brand-pink" /> Jornada laboral
        </h1>
        <p className="text-brand-dark/50 text-sm mt-1">Marcaje de entrada y salida, y control de horas del equipo.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Zona de marcaje ── */}
        <div className="bg-white rounded-2xl card-shadow p-6">
          <h2 className="font-semibold text-brand-dark mb-4">Marcar jornada</h2>

          {isSmallScreen ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              {DESKTOP_MESSAGE}
            </p>
          ) : !staffLoaded ? (
            <p className="text-sm text-brand-dark/40">Cargando personal...</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-brand-dark/50">
              Todavía no hay personal activo registrado. Agregalo desde Usuarios.
            </p>
          ) : (
            <div className="space-y-4">
              <StaffPicker staff={staff} value={selectedStaffId} onChange={(id) => { setSelectedStaffId(id); setMarcajeError(""); }} disabled={marcajeBusy} />

              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={!selectedStaff || marcajeBusy}
                  placeholder="••••"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm tracking-[0.5em] text-center focus:outline-none focus:border-brand-pink disabled:bg-brand-muted/20"
                />
              </div>

              {selectedStaff?.openShift && (
                <p className="text-xs text-brand-dark/50">
                  Trabajando desde las {new Date(selectedStaff.openShift.startedAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}

              {marcajeError && <p className="text-sm text-red-600">{marcajeError}</p>}

              <Button
                type="button"
                className="w-full"
                disabled={!selectedStaff || pin.length !== 4 || marcajeBusy}
                onClick={handleMarcaje}
              >
                {marcajeBusy ? "Procesando..." : selectedStaff?.openShift ? "Finalizar jornada" : "Iniciar jornada"}
              </Button>
            </div>
          )}
        </div>

        {/* ── Quiénes están trabajando ahora ── */}
        <div className="bg-white rounded-2xl card-shadow p-6">
          <h2 className="font-semibold text-brand-dark mb-4">Trabajando ahora ({working.length})</h2>
          {working.length === 0 ? (
            <p className="text-sm text-brand-dark/40">Nadie tiene una jornada abierta en este momento.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {working.map((s) => {
                const elapsedMinutes = Math.max(0, Math.floor((nowMs - new Date(s.openShift.startedAt).getTime()) / 60000));
                return (
                  <div key={s._id} className="border border-brand-muted rounded-xl p-4">
                    <p className="font-medium text-brand-dark truncate">{s.name}</p>
                    <p className="text-xs text-brand-dark/40 mb-2">{ROLE_LABELS[s.role]}</p>
                    <p className="text-lg font-bold text-brand-pink tabular-nums">{formatHoursMinutes(elapsedMinutes)}</p>
                    <p className="text-xs text-brand-dark/40">
                      desde las {new Date(s.openShift.startedAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Horas acumuladas (solo admin) ── */}
      {isAdmin && (
        <div className="bg-white rounded-2xl card-shadow p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <h2 className="font-semibold text-brand-dark">Horas acumuladas</h2>
            <PeriodPicker type={periodType} refCR={periodRef} onTypeChange={setPeriodType} onRefChange={setPeriodRef} />
          </div>

          {hoursLoading ? (
            <p className="text-sm text-brand-dark/40">Cargando horas...</p>
          ) : !hoursData || hoursData.totals.length === 0 ? (
            <p className="text-sm text-brand-dark/40">Sin jornadas registradas en este período.</p>
          ) : (
            <div className="space-y-3">
              {hoursData.totals.map((t) => {
                const pct = Math.round((t.minutes / maxMinutes) * 100);
                const hasOpen = t.openCount > 0;
                const hasAdjusted = adjustedStaffIds.has(t.staffUserId);
                return (
                  <div key={t.staffUserId} className="border border-brand-muted rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-brand-dark truncate">{t.name}</p>
                        <p className="text-xs text-brand-dark/40">{ROLE_LABELS[t.role]}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasOpen && (
                          <span className="text-xs font-medium bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Turno abierto</span>
                        )}
                        {hasAdjusted && (
                          <span className="flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            <Pencil className="w-3 h-3" /> Ajustado
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between text-sm mb-1.5">
                      <span className="font-bold text-brand-dark">{formatHoursMinutes(t.minutes)}</span>
                      <span className="text-brand-dark/40">{t.shiftsCount} jornada{t.shiftsCount === 1 ? "" : "s"}</span>
                    </div>
                    <div className="h-2 bg-brand-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full gradient-bg" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Turnos pendientes de cerrar (>16h) ── */}
          {stuckShifts.length > 0 && (
            <div className="mt-8 pt-6 border-t border-brand-muted">
              <h3 className="flex items-center gap-2 font-semibold text-amber-700 mb-4">
                <AlertTriangle className="w-4 h-4" /> Turnos abiertos hace más de 16 horas
              </h3>
              <div className="space-y-2">
                {stuckShifts.map((s) => {
                  const elapsedH = Math.floor((nowMs - new Date(s.startedAt).getTime()) / 3_600_000);
                  return (
                    <div key={s._id} className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-brand-dark truncate">{s.staffName}</p>
                        <p className="text-xs text-brand-dark/50">
                          Desde las {new Date(s.startedAt).toLocaleString("es-CR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {elapsedH} h abierto
                        </p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setClosingShift(s)} className="shrink-0">
                        Cerrar jornada
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!isAdmin && (
        <p className="flex items-center gap-2 text-xs text-brand-dark/30">
          <ShieldCheck className="w-3.5 h-3.5" /> El resumen de horas acumuladas es solo para administradores.
        </p>
      )}

      <CloseStuckShiftDialog
        shift={closingShift}
        onClose={() => setClosingShift(null)}
        onClosed={() => { setClosingShift(null); loadHours(); loadActive(); }}
      />
    </div>
  );
}
