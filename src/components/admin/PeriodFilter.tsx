"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type PeriodMode = "dia" | "semana" | "mes" | "anio";

interface Props {
  mode: PeriodMode;
  anchor: Date;
  onChange: (mode: PeriodMode, anchor: Date) => void;
}

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export function getRange(mode: PeriodMode, anchor: Date): { from: Date; to: Date } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (mode === "dia") {
    return {
      from: new Date(y, m, d, 0, 0, 0, 0),
      to:   new Date(y, m, d, 23, 59, 59, 999),
    };
  }
  if (mode === "semana") {
    const day = anchor.getDay(); // 0=sun
    const mon = new Date(y, m, d - ((day + 6) % 7));
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);
    return { from: mon, to: sun };
  }
  if (mode === "mes") {
    return {
      from: new Date(y, m, 1, 0, 0, 0, 0),
      to:   new Date(y, m + 1, 0, 23, 59, 59, 999),
    };
  }
  // anio
  return {
    from: new Date(y, 0, 1, 0, 0, 0, 0),
    to:   new Date(y, 11, 31, 23, 59, 59, 999),
  };
}

function advance(mode: PeriodMode, anchor: Date, delta: number): Date {
  const a = new Date(anchor);
  if (mode === "dia")   a.setDate(a.getDate() + delta);
  if (mode === "semana") a.setDate(a.getDate() + delta * 7);
  if (mode === "mes")   a.setMonth(a.getMonth() + delta);
  if (mode === "anio")  a.setFullYear(a.getFullYear() + delta);
  return a;
}

function periodLabel(mode: PeriodMode, anchor: Date): string {
  const { from, to } = getRange(mode, anchor);
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (mode === "dia") {
    return `${DAYS_ES[anchor.getDay()]} ${d} ${MONTHS_ES[m]} ${y}`;
  }
  if (mode === "semana") {
    const fmt = (dt: Date) => `${dt.getDate()} ${MONTHS_ES[dt.getMonth()].slice(0,3)}`;
    return `${fmt(from)} – ${fmt(to)} ${to.getFullYear()}`;
  }
  if (mode === "mes") return `${MONTHS_ES[m]} ${y}`;
  return String(y);
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function toWeekInputValue(anchor: Date) {
  const { from } = getRange("semana", anchor);
  const jan1 = new Date(from.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((from.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${from.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

const MODE_LABELS: Record<PeriodMode, string> = {
  dia: "Día", semana: "Semana", mes: "Mes", anio: "Año",
};

export default function PeriodFilter({ mode, anchor, onChange }: Props) {
  function setMode(m: PeriodMode) { onChange(m, anchor); }
  function prev() { onChange(mode, advance(mode, anchor, -1)); }
  function next() { onChange(mode, advance(mode, anchor, +1)); }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) return;
    if (mode === "dia")    { onChange("dia",    new Date(val + "T12:00:00")); }
    if (mode === "semana") {
      const [yr, wk] = val.split("-W").map(Number);
      const jan4 = new Date(yr, 0, 4);
      const d = new Date(jan4);
      d.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (wk - 1) * 7);
      onChange("semana", d);
    }
  }

  function handleMonthInput(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>, part: "month" | "year") {
    const a = new Date(anchor);
    if (part === "month") a.setMonth(Number(e.target.value));
    if (part === "year")  a.setFullYear(Number(e.target.value) || a.getFullYear());
    onChange("mes", a);
  }

  function handleYearInput(e: React.ChangeEvent<HTMLInputElement>) {
    const yr = parseInt(e.target.value);
    if (yr > 2000 && yr < 2100) onChange("anio", new Date(yr, 0, 1));
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      {/* Mode tabs */}
      <div className="flex rounded-xl border border-brand-muted overflow-hidden shrink-0">
        {(Object.keys(MODE_LABELS) as PeriodMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? "gradient-bg text-white"
                : "text-brand-dark/50 hover:text-brand-dark hover:bg-brand-muted/30"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Navigator */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <button
          type="button"
          onClick={prev}
          className="p-1.5 rounded-lg border border-brand-muted text-brand-dark/50 hover:text-brand-dark hover:bg-brand-muted/20 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="flex-1 text-center text-sm font-medium text-brand-dark truncate px-1">
          {periodLabel(mode, anchor)}
        </span>

        <button
          type="button"
          onClick={next}
          className="p-1.5 rounded-lg border border-brand-muted text-brand-dark/50 hover:text-brand-dark hover:bg-brand-muted/20 transition-colors shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Period-specific selector */}
        {mode === "dia" && (
          <input
            type="date"
            value={toDateInputValue(anchor)}
            onChange={handleDateInput}
            className="border border-brand-muted rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-pink text-brand-dark shrink-0"
          />
        )}
        {mode === "semana" && (
          <input
            type="week"
            value={toWeekInputValue(anchor)}
            onChange={handleDateInput}
            className="border border-brand-muted rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-pink text-brand-dark shrink-0"
          />
        )}
        {mode === "mes" && (
          <div className="flex gap-1 shrink-0">
            <select
              value={anchor.getMonth()}
              onChange={(e) => handleMonthInput(e, "month")}
              className="border border-brand-muted rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-pink text-brand-dark"
            >
              {MONTHS_ES.map((mn, i) => <option key={i} value={i}>{mn}</option>)}
            </select>
            <input
              type="number"
              value={anchor.getFullYear()}
              onChange={(e) => handleMonthInput(e, "year")}
              className="w-16 border border-brand-muted rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-pink text-brand-dark"
            />
          </div>
        )}
        {mode === "anio" && (
          <input
            type="number"
            value={anchor.getFullYear()}
            onChange={handleYearInput}
            min={2020} max={2099}
            className="w-20 border border-brand-muted rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-pink text-brand-dark shrink-0"
          />
        )}
      </div>
    </div>
  );
}
