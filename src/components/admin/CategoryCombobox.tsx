"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Check, Plus, Loader2 } from "lucide-react";

interface Category {
  _id: string;
  label: string;
}

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onCategoryCreated?: (cat: Category) => void;
}

export default function CategoryCombobox({
  value,
  onChange,
  onCategoryCreated,
}: CategoryComboboxProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [close]);

  const filtered = query.trim()
    ? categories.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase())
      )
    : categories;

  const exactMatch = categories.some(
    (c) => c.label.toLowerCase() === query.trim().toLowerCase()
  );
  const showAdd = query.trim().length > 0 && !exactMatch;

  async function handleCreate() {
    const label = query.trim();
    if (!label) return;
    setCreating(true);
    try {
      const r = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const d = await r.json();
      if (d.category) {
        setCategories((prev) =>
          [...prev, d.category].sort((a, b) => a.label.localeCompare(b.label))
        );
        onChange(d.category.label);
        setQuery(d.category.label);
        onCategoryCreated?.(d.category);
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  function select(cat: Category) {
    onChange(cat.label);
    setQuery(cat.label);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center border border-brand-muted rounded-xl px-3 py-2 text-sm gap-1 focus-within:border-brand-pink bg-white cursor-text"
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar o escribir..."
          className="flex-1 outline-none bg-transparent"
        />
        <ChevronDown
          className={`w-4 h-4 text-brand-dark/30 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-brand-muted rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-44 overflow-y-auto">
            {filtered.map((cat) => (
              <button
                key={cat._id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(cat)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-brand-muted/30 flex items-center justify-between gap-2"
              >
                <span>{cat.label}</span>
                {cat.label === value && (
                  <Check className="w-3.5 h-3.5 text-brand-pink shrink-0" />
                )}
              </button>
            ))}
            {filtered.length === 0 && !showAdd && (
              <p className="px-3 py-2 text-sm text-brand-dark/40 italic">
                Sin resultados
              </p>
            )}
          </div>

          {showAdd && (
            <div className="border-t border-brand-muted">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreate}
                disabled={creating}
                className="w-full text-left px-3 py-2 text-sm text-brand-pink hover:bg-brand-pink/5 flex items-center gap-2 disabled:opacity-60 font-medium"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                )}
                Agregar &ldquo;{query.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
