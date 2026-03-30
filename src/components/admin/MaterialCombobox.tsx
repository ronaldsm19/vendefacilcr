"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { IRawMaterial } from "@/models/RawMaterial";

interface MaterialComboboxProps {
  materials: IRawMaterial[];
  value: string;
  onChange: (id: string) => void;
}

export default function MaterialCombobox({ materials, value, onChange }: MaterialComboboxProps) {
  const selected      = materials.find((m) => String(m._id) === value);
  const [query, setQuery]       = useState(selected ? `${selected.name} (${selected.unit})` : "");
  const [open, setOpen]         = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mat = materials.find((m) => String(m._id) === value);
    setQuery(mat ? `${mat.name} (${mat.unit})` : "");
  }, [value, materials]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
        const mat = materials.find((m) => String(m._id) === value);
        setQuery(mat ? `${mat.name} (${mat.unit})` : "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [close, value, materials]);

  // Recalculate dropdown position when opening
  function openDropdown() {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownH  = Math.min(220, spaceBelow - 8);

      setDropdownStyle({
        position: "fixed",
        top:      rect.bottom + 4,
        left:     rect.left,
        width:    rect.width,
        maxHeight: Math.max(dropdownH, 120),
        zIndex:   9999,
      });
    }
    setOpen(true);
  }

  const filtered = query.trim()
    ? materials.filter((m) =>
        `${m.name} ${m.unit}`.toLowerCase().includes(query.toLowerCase())
      )
    : materials;

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (!open) openDropdown();
    if (value) onChange("");
  }

  function handleFocus() {
    setQuery("");
    openDropdown();
  }

  function select(mat: IRawMaterial) {
    onChange(String(mat._id));
    setQuery(`${mat.name} (${mat.unit})`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center border border-brand-muted rounded-xl px-3 py-2 text-sm gap-1.5 focus-within:border-brand-pink bg-white">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Buscar material..."
          className="flex-1 outline-none bg-transparent text-sm min-w-0"
        />
        <ChevronDown
          className={`w-4 h-4 text-brand-dark/30 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div
          style={dropdownStyle}
          className="bg-white border border-brand-muted rounded-xl shadow-lg overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-brand-dark/40">Sin resultados</p>
          ) : (
            filtered.map((m) => (
              <button
                key={String(m._id)}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(m)}
                className={`w-full text-left px-3 py-2.5 hover:bg-brand-muted/30 flex items-center gap-2.5 border-b border-brand-muted/50 last:border-0 ${
                  String(m._id) === value ? "bg-brand-pink/5" : ""
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-brand-pink shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-dark truncate">{m.name}</p>
                  <p className="text-xs text-brand-dark/40">{m.unit}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
