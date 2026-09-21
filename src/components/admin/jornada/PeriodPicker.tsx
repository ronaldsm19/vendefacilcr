"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatPeriodLabel, shiftPeriod, type PeriodType } from "@/lib/workPeriod";

interface PeriodPickerProps {
  type: PeriodType;
  refCR: Date;
  onTypeChange: (type: PeriodType) => void;
  onRefChange: (refCR: Date) => void;
}

/** Selector de Quincena/Mes + navegación anterior/siguiente, compartido entre el panel de
 * horas acumuladas y el reparto del 10% en Finanzas — misma noción de período en los dos. */
export default function PeriodPicker({ type, refCR, onTypeChange, onRefChange }: PeriodPickerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 bg-brand-muted/50 rounded-full p-1">
        {(["quincena", "mes"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              type === t ? "bg-white shadow text-brand-dark" : "text-brand-dark/50 hover:text-brand-dark"
            }`}
          >
            {t === "quincena" ? "Quincena" : "Mes"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onRefChange(shiftPeriod(type, refCR, -1))}
          className="p-1.5 rounded-lg text-brand-dark/50 hover:text-brand-dark hover:bg-brand-muted/50 transition-colors cursor-pointer"
          aria-label="Período anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-brand-dark min-w-[11rem] text-center">
          {formatPeriodLabel(type, refCR)}
        </span>
        <button
          type="button"
          onClick={() => onRefChange(shiftPeriod(type, refCR, 1))}
          className="p-1.5 rounded-lg text-brand-dark/50 hover:text-brand-dark hover:bg-brand-muted/50 transition-colors cursor-pointer"
          aria-label="Período siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
