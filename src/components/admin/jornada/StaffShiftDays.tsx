"use client";

import { Pencil } from "lucide-react";
import type { Role } from "@/lib/permissions";
import { crDayKey, formatCRDayLabel, formatCRTime, formatHoursMinutes } from "@/lib/workPeriod";
import type { EditableShift } from "@/components/admin/jornada/EditShiftDialog";

export interface JornadaShift {
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
  edits?: {
    at: string;
    byName: string;
    note: string;
    fromStartedAt: string;
    fromEndedAt: string | null;
    toStartedAt: string;
    toEndedAt: string | null;
  }[];
}

/** Datos para el diálogo de edición, con lo que la persona marcó antes de la primera edición. */
export function toEditableShift(s: JornadaShift): EditableShift {
  const edits = s.edits ?? [];
  return {
    _id: s._id,
    staffName: s.staffName,
    status: s.status,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    originalStartedAt: edits[0]?.fromStartedAt ?? null,
    // La salida original es la de antes de la primera edición que ya la tenía (una corrección de
    // entrada hecha con la jornada abierta no tiene salida que recordar).
    originalEndedAt: edits.find((e) => e.fromEndedAt)?.fromEndedAt ?? null,
  };
}

interface StaffShiftDaysProps {
  shifts: JornadaShift[];
  nowMs: number;
  onEdit: (shift: EditableShift) => void;
}

/** Jornadas de una persona agrupadas por día de Costa Rica (el día en que empezó cada una). */
export default function StaffShiftDays({ shifts, nowMs, onEdit }: StaffShiftDaysProps) {
  const byDay = new Map<string, JornadaShift[]>();
  for (const s of shifts) {
    const key = crDayKey(new Date(s.startedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      shifts: list.sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
      minutes: list.reduce((sum, s) => sum + (s.status === "cerrada" ? s.minutes : 0), 0),
      hasOpen: list.some((s) => s.status === "abierta"),
    }));

  if (days.length === 0) {
    return <p className="text-sm text-brand-dark/40">Sin jornadas en este período.</p>;
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day.key}>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-brand-dark">{formatCRDayLabel(day.key)}</p>
            <p className="text-sm font-bold text-brand-dark tabular-nums shrink-0">
              {formatHoursMinutes(day.minutes)}
              {day.hasOpen && <span className="text-xs font-normal text-emerald-600"> + en curso</span>}
            </p>
          </div>
          <div className="space-y-2">
            {day.shifts.map((s) => {
              const start = new Date(s.startedAt);
              const end = s.endedAt ? new Date(s.endedAt) : null;
              const minutes = end ? s.minutes : Math.max(0, Math.floor((nowMs - start.getTime()) / 60000));
              const nextDay = end && crDayKey(end) !== day.key;
              const lastEdit = s.edits?.length ? s.edits[s.edits.length - 1] : null;
              return (
                <div key={s._id} className="flex items-center justify-between gap-3 bg-brand-muted/20 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-brand-dark tabular-nums">
                      {formatCRTime(start)} – {end ? `${formatCRTime(end)}${nextDay ? " (día sig.)" : ""}` : "en curso"}
                      <span className="text-brand-dark/50"> · {formatHoursMinutes(minutes)}</span>
                    </p>
                    {lastEdit && (
                      <p className="text-xs text-amber-700 mt-0.5 break-words">
                        Editada por {lastEdit.byName}{lastEdit.note ? `: ${lastEdit.note}` : ""}
                      </p>
                    )}
                    {s.closedBy === "admin" && (
                      <p className="text-xs text-amber-700 mt-0.5 break-words">
                        Cerrada por {s.adjustedByName || "el admin"}{s.adjustNote ? `: ${s.adjustNote}` : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(toEditableShift(s))}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-brand-pink hover:underline"
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
