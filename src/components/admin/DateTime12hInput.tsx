"use client";

import { useState } from "react";

/**
 * Fecha y hora en formato de 12 horas (a. m. / p. m.), la hora tica.
 *
 * Reemplaza a <input type="datetime-local">, que según la configuración del sistema operativo
 * muestra 20:00 en vez de 8:00 p. m. Recibe y devuelve el mismo texto que ese input
 * ("YYYY-MM-DDTHH:mm", en 24 h por dentro, o "" mientras falte algo), así que cada pantalla lo
 * interpreta exactamente igual que antes.
 */

interface Parts {
  date: string;
  hour: string;   // "1".."12" o "" si no se eligió
  minute: string; // "00".."59" o ""
  period: "am" | "pm";
}

const EMPTY: Parts = { date: "", hour: "", minute: "", period: "am" };
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const FIELD = "border border-brand-muted rounded-xl py-2 text-sm bg-white focus:outline-none focus:border-brand-pink disabled:bg-brand-muted/20";

function toParts(value: string): Parts {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return EMPTY;
  const h24 = Number(m[2]);
  return { date: m[1], hour: String(h24 % 12 === 0 ? 12 : h24 % 12), minute: m[3], period: h24 >= 12 ? "pm" : "am" };
}

function toValue(p: Parts): string {
  if (!p.date || !p.hour || !p.minute) return "";
  const h24 = (Number(p.hour) % 12) + (p.period === "pm" ? 12 : 0);
  return `${p.date}T${String(h24).padStart(2, "0")}:${p.minute}`;
}

interface DateTime12hInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Mismo formato que value; limita la fecha que se puede elegir. */
  max?: string;
  disabled?: boolean;
  className?: string;
}

export default function DateTime12hInput({ value, onChange, max, disabled, className = "" }: DateTime12hInputProps) {
  // Lo que se va eligiendo mientras falta algún campo (el valor de afuera sigue en "").
  const [draft, setDraft] = useState<Parts>(() => toParts(value));
  // Con valor completo manda el de afuera; sin valor, el borrador, salvo que el borrador esté
  // completo: eso significa que afuera limpiaron el campo (p. ej. se reinició el formulario).
  const parts = value ? toParts(value) : toValue(draft) ? EMPTY : draft;

  function update(patch: Partial<Parts>) {
    const next = { ...parts, ...patch };
    setDraft(next);
    onChange(toValue(next));
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <input
        type="date"
        value={parts.date}
        max={max?.slice(0, 10)}
        disabled={disabled}
        onChange={(e) => update({ date: e.target.value })}
        aria-label="Fecha"
        className={`${FIELD} px-3 flex-1 min-w-[9.5rem]`}
        style={{ colorScheme: "light" }}
      />
      <div className="flex items-center gap-1">
        <select
          value={parts.hour}
          disabled={disabled}
          onChange={(e) => update({ hour: e.target.value })}
          aria-label="Hora"
          className={`${FIELD} px-2`}
        >
          <option value="" disabled>--</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-brand-dark/50">:</span>
        <select
          value={parts.minute}
          disabled={disabled}
          onChange={(e) => update({ minute: e.target.value })}
          aria-label="Minutos"
          className={`${FIELD} px-2`}
        >
          <option value="" disabled>--</option>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={parts.period}
          disabled={disabled}
          onChange={(e) => update({ period: e.target.value as Parts["period"] })}
          aria-label="a. m. o p. m."
          className={`${FIELD} px-2`}
        >
          <option value="am">a. m.</option>
          <option value="pm">p. m.</option>
        </select>
      </div>
    </div>
  );
}
