"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export interface ActiveStaffEntry {
  _id: string;
  name: string;
  role: Role;
  openShift: { _id: string; startedAt: string } | null;
}

interface StaffPickerProps {
  staff: ActiveStaffEntry[];
  value: string;
  onChange: (staffUserId: string) => void;
  disabled?: boolean;
}

/** Botón con lista desplegable propia (no un <select> del navegador), mismo lenguaje visual
 * que los combobox del proyecto (panel absolute/rounded-xl/shadow, cierre por click afuera). */
export default function StaffPicker({ staff, value, onChange, disabled }: StaffPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const selected = staff.find((s) => s._id === value) ?? null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 border border-brand-muted rounded-xl px-3 py-2.5 text-sm bg-white hover:border-brand-pink/40 focus:outline-none focus:border-brand-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate font-medium text-brand-dark">{selected.name}</span>
            <span className="text-xs text-brand-dark/40 shrink-0">{ROLE_LABELS[selected.role]}</span>
          </span>
        ) : (
          <span className="text-brand-dark/40">Elegí a la persona…</span>
        )}
        <ChevronDown className={`w-4 h-4 text-brand-dark/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-brand-muted rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {staff.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-brand-dark/40">No hay personal activo</p>
          ) : (
            staff.map((s) => (
              <button
                key={s._id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(s._id); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 hover:bg-brand-muted/30 transition-colors border-b border-brand-muted/50 last:border-0 cursor-pointer ${
                  value === s._id ? "bg-brand-pink/5" : ""
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-brand-dark">{s.name}</span>
                  <span className="text-xs text-brand-dark/40 shrink-0">{ROLE_LABELS[s.role]}</span>
                </span>
                {s.openShift && (
                  <span className="text-xs font-medium text-emerald-600 shrink-0">● Trabajando</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
