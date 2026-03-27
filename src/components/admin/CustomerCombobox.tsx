"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, User } from "lucide-react";

interface Customer {
  customerName: string;
  phone: string;
}

interface CustomerComboboxProps {
  value: string;
  onChangeName: (name: string) => void;
  onSelectCustomer: (name: string, phone: string) => void;
}

export default function CustomerCombobox({
  value,
  onChangeName,
  onSelectCustomer,
}: CustomerComboboxProps) {
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [close]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChangeName(val);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/customers?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        setResults(d.customers ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function handleFocus() {
    if (value.trim()) setOpen(true);
  }

  function select(c: Customer) {
    onSelectCustomer(c.customerName, c.phone);
    setResults([]);
    setOpen(false);
  }

  const showDropdown = open && results.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center border border-brand-muted rounded-xl px-3 py-2 text-sm gap-1 focus-within:border-brand-pink bg-white">
        <input
          type="text"
          required
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Nombre del cliente"
          className="flex-1 outline-none bg-transparent"
        />
        {loading ? (
          <span className="w-4 h-4 shrink-0 border-2 border-brand-pink/40 border-t-brand-pink rounded-full animate-spin" />
        ) : (
          value.trim() && (
            <ChevronDown
              className={`w-4 h-4 text-brand-dark/20 shrink-0 transition-transform ${
                showDropdown ? "rotate-180" : ""
              }`}
            />
          )
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-brand-muted rounded-xl shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              key={c.customerName}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(c)}
              className="w-full text-left px-3 py-2.5 hover:bg-brand-muted/30 flex items-center gap-2.5 border-b border-brand-muted/50 last:border-0"
            >
              <User className="w-3.5 h-3.5 text-brand-pink shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-brand-dark truncate">
                  {c.customerName}
                </p>
                {c.phone && (
                  <p className="text-xs text-brand-dark/50">{c.phone}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
