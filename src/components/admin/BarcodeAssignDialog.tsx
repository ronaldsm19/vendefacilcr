"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_BARCODE, nextInternalCode, normalizeBarcode } from "@/lib/barcode";

export interface BarcodeProduct {
  _id: string;
  name: string;
  category: string;
  barcode?: string;
}

type RowState = { status: "saving" } | { status: "saved" } | { status: "error"; message: string };

/**
 * Asignar códigos de barras de corrido (Productos → Códigos). Se pone el cursor en un producto,
 * se escanea el código que ya trae (o se escribe el interno) y el lector, al mandar Enter, lo guarda
 * y pasa al siguiente. Sirve para cargar los códigos que el negocio ya usaba sin abrir cada ficha.
 */
export default function BarcodeAssignDialog({
  products,
  onAssigned,
}: {
  products: BarcodeProduct[];
  /** El código quedó guardado: la página actualiza su lista sin recargar. */
  onAssigned: (productId: string, barcode: string) => void;
}) {
  const [filter, setFilter] = useState<"pendientes" | "todos">(
    products.some((p) => !p.barcode) ? "pendientes" : "todos"
  );
  // Los que no tenían código al elegir el filtro: así un producto no desaparece de la lista
  // apenas se le asigna, y el cursor no salta.
  const [pendingIds, setPendingIds] = useState(() => new Set(products.filter((p) => !p.barcode).map((p) => p._id)));
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const inputs = useRef(new Map<string, HTMLInputElement>());
  /** Código que se está guardando por producto, para no mandarlo dos veces (Enter + salir del campo). */
  const inFlight = useRef(new Map<string, string>());

  const withoutCode = products.filter((p) => !p.barcode).length;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => filter === "todos" || pendingIds.has(p._id))
      .filter((p) =>
        !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.category.localeCompare(b.category, "es") || a.name.localeCompare(b.name, "es"));
  }, [products, filter, pendingIds, search]);

  function chooseFilter(next: "pendientes" | "todos") {
    setFilter(next);
    setPendingIds(new Set(products.filter((p) => !p.barcode).map((p) => p._id)));
  }

  function valueOf(p: BarcodeProduct) {
    return drafts[p._id] ?? p.barcode ?? "";
  }

  function focusNext(productId: string) {
    const idx = visible.findIndex((p) => p._id === productId);
    const next = visible[idx + 1];
    if (next) inputs.current.get(next._id)?.focus();
  }

  async function save(p: BarcodeProduct, moveNext: boolean) {
    const raw = valueOf(p);
    const code = normalizeBarcode(raw);
    if (code === (p.barcode ?? "") || (code !== null && inFlight.current.get(p._id) === code)) {
      if (moveNext) focusNext(p._id);
      return;
    }
    if (code === null) {
      setRowState((s) => ({ ...s, [p._id]: { status: "error", message: "Solo letras sin tilde, números y - . / + % $" } }));
      return;
    }
    // Se marca antes de mover el cursor: al salir del campo su onBlur no debe mandarlo otra vez.
    inFlight.current.set(p._id, code);
    setRowState((s) => ({ ...s, [p._id]: { status: "saving" } }));
    // El cursor pasa al siguiente de una vez, sin esperar al servidor: si el lector manda el
    // próximo código mientras este se guarda, no se pega al producto anterior.
    if (moveNext) focusNext(p._id);
    try {
      const res = await fetch(`/api/admin/products/${p._id}/barcode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowState((s) => ({ ...s, [p._id]: { status: "error", message: data.error ?? "No se pudo guardar" } }));
        return;
      }
      onAssigned(p._id, data.barcode ?? code);
      // Solo se suelta el borrador si nadie lo cambió mientras se guardaba.
      setDrafts((d) => {
        if (d[p._id] !== raw) return d;
        const next = { ...d };
        delete next[p._id];
        return next;
      });
      setRowState((s) => ({ ...s, [p._id]: { status: "saved" } }));
    } catch {
      setRowState((s) => ({ ...s, [p._id]: { status: "error", message: "Sin conexión, probá de nuevo" } }));
    } finally {
      inFlight.current.delete(p._id);
    }
  }

  function generate(p: BarcodeProduct) {
    const taken = [...products.map((x) => x.barcode), ...Object.values(drafts)];
    const code = nextInternalCode(taken);
    setDrafts((d) => ({ ...d, [p._id]: code }));
    setRowState((s) => { const next = { ...s }; delete next[p._id]; return next; });
    inputs.current.get(p._id)?.focus();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-dark/60">
        Poné el cursor en un producto y escaneá su código, o escribilo y dale Enter. Se guarda solo y
        pasa al siguiente. Si el producto no trae código, &quot;Generar&quot; le pone el siguiente número libre.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5 shrink-0" role="tablist" aria-label="Qué productos mostrar">
          {([["pendientes", `Sin código (${withoutCode})`], ["todos", `Todos (${products.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => chooseFilter(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                filter === key ? "gradient-bg text-white border-transparent" : "bg-white text-brand-dark/60 border-brand-muted hover:text-brand-dark"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-dark/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o código"
            className="w-full pl-8 pr-3 py-1.5 border border-brand-muted rounded-full text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
      </div>

      <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
        {visible.length === 0 && (
          <p className="text-sm text-brand-dark/40 text-center py-8">
            {filter === "pendientes" && !search ? "Todos los productos ya tienen código." : "No hay productos con esa búsqueda."}
          </p>
        )}
        {visible.map((p) => {
          const state = rowState[p._id];
          const value = valueOf(p);
          return (
            <div key={p._id} className="rounded-xl border border-brand-muted px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-dark truncate">{p.name}</p>
                  <p className="text-xs text-brand-dark/40 truncate">{p.category}</p>
                </div>
                <input
                  ref={(el) => { if (el) inputs.current.set(p._id, el); else inputs.current.delete(p._id); }}
                  type="text"
                  value={value}
                  maxLength={MAX_BARCODE}
                  autoComplete="off"
                  aria-label={`Código de ${p.name}`}
                  placeholder="Código"
                  readOnly={state?.status === "saving"}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\s/g, "").toUpperCase();
                    setDrafts((d) => ({ ...d, [p._id]: v }));
                    if (state) setRowState((s) => { const next = { ...s }; delete next[p._id]; return next; });
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(p, true); } }}
                  onBlur={() => { if (drafts[p._id] !== undefined) save(p, false); }}
                  className={`w-32 sm:w-40 border rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none ${
                    state?.status === "error" ? "border-red-300 focus:border-red-400" : "border-brand-muted focus:border-brand-pink"
                  }`}
                />
                <div className="w-8 flex justify-center shrink-0">
                  {state?.status === "saving" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-brand-dark/40" />
                  ) : state?.status === "saved" ? (
                    <Check className="w-4 h-4 text-emerald-600" aria-label="Guardado" />
                  ) : !value ? (
                    <Button type="button" size="icon-sm" variant="secondary" title="Generar código" aria-label={`Generar código para ${p.name}`} onClick={() => generate(p)}>
                      <Wand2 className="w-4 h-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {state?.status === "error" && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {state.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
