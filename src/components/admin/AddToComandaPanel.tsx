"use client";

import { useState } from "react";
import { Check, Minus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lineTotal, type LineExtra } from "@/lib/pricing";

/**
 * Agregar a una comanda abierta lo que la mesa consumió y no se había anotado, desde el cobro de la
 * mesa en el POS. Arma una lista y la manda de una vez a POST /api/admin/comandas/[id]/items, que no
 * imprime en cocina ni en barra: la cuenta ya se está pagando.
 */

export interface AddableProduct {
  _id: string;
  name: string;
  price: number;
  category: string;
  extras?: LineExtra[];
}

interface Line {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  extras: LineExtra[];
}

interface AddToComandaPanelProps {
  comandaId: string;
  comandaNumber: number;
  products: AddableProduct[];
  onCancel: () => void;
  /** count = cuántas líneas se agregaron al final de la comanda. */
  onAdded: (added: { count: number; summary: string }) => void;
}

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;
}

/** Para buscar sin que importen mayúsculas ni tildes: "cafe" encuentra "Café". */
function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function lineKey(productId: string, extras: LineExtra[]) {
  return `${productId}|${extras.map((e) => e.name).sort().join(",")}`;
}

export default function AddToComandaPanel({ comandaId, comandaNumber, products, onCancel, onAdded }: AddToComandaPanelProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AddableProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const q = norm(query.trim());
  const results = products.filter((p) => norm(p.name).includes(q) || norm(p.category).includes(q));
  const chosenExtras: LineExtra[] = (selected?.extras ?? [])
    .filter((e) => extraNames.includes(e.name))
    .map((e) => ({ name: e.name, price: e.price }));
  const total = lines.reduce((s, l) => s + lineTotal({ unitPrice: l.price, quantity: l.quantity, extras: l.extras }), 0);

  function pick(p: AddableProduct) {
    setSelected(p);
    setQty(1);
    setExtraNames([]);
    setError("");
  }

  function addLine() {
    if (!selected) return;
    const key = lineKey(selected._id, chosenExtras);
    setLines((prev) =>
      prev.some((l) => lineKey(l.productId, l.extras) === key)
        ? prev.map((l) => (lineKey(l.productId, l.extras) === key ? { ...l, quantity: Math.min(99, l.quantity + qty) } : l))
        : [...prev, { productId: selected._id, name: selected.name, price: selected.price, quantity: qty, extras: chosenExtras }]
    );
    setSelected(null);
    setQuery("");
  }

  async function submit() {
    if (lines.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/comandas/${comandaId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, extras: l.extras.map((e) => e.name) })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo agregar a la comanda");
        return;
      }
      onAdded({ count: lines.length, summary: lines.map((l) => `${l.quantity}× ${l.name}`).join(", ") });
    } catch {
      setError("No se pudo agregar a la comanda. Revisá tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div>
        <p className="text-sm font-semibold text-brand-dark">Agregar a la comanda #{comandaNumber}</p>
        <p className="text-xs text-brand-dark/50">
          Queda en la cuenta de la mesa para cobrarlo. No se imprime en cocina ni en barra.
        </p>
      </div>

      {selected ? (
        <div className="rounded-xl border border-brand-pink/40 p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-dark">{selected.name}</p>
              <p className="text-xs text-brand-dark/50">{fmt(selected.price)}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Elegir otro producto"
              className="p-1 rounded-lg text-brand-dark/40 hover:bg-brand-muted/30">
              <X className="w-4 h-4" />
            </button>
          </div>

          {(selected.extras ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-brand-dark/50">Extras</p>
              {(selected.extras ?? []).map((e) => (
                <label key={e.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      className="accent-brand-pink"
                      checked={extraNames.includes(e.name)}
                      onChange={(ev) => setExtraNames((prev) => ev.target.checked ? [...prev, e.name] : prev.filter((n) => n !== e.name))}
                    />
                    <span className="truncate">{e.name}</span>
                  </span>
                  <span className="text-xs text-brand-dark/50 shrink-0">+{fmt(e.price)}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))} aria-label="Menos"
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{qty}</span>
              <button type="button" onClick={() => setQty((v) => Math.min(99, v + 1))} aria-label="Más"
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <Button type="button" size="sm" onClick={addLine}>
              <Check className="w-3.5 h-3.5" /> Añadir · {fmt(lineTotal({ unitPrice: selected.price, quantity: qty, extras: chosenExtras }))}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-brand-dark/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto..."
              autoFocus
              className="w-full border border-brand-muted rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-brand-muted divide-y divide-brand-muted">
            {results.length === 0 ? (
              <p className="text-sm text-brand-dark/40 text-center py-6">Sin resultados.</p>
            ) : (
              results.map((p) => (
                <button key={p._id} type="button" onClick={() => pick(p)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-brand-muted/20">
                  <span className="min-w-0">
                    <span className="block truncate text-brand-dark">{p.name}</span>
                    {p.category && <span className="block truncate text-xs text-brand-dark/40">{p.category}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-brand-pink">{fmt(p.price)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {lines.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wide">Para agregar</p>
          {lines.map((l) => {
            const key = lineKey(l.productId, l.extras);
            return (
              <div key={key} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block">{l.quantity}× {l.name}</span>
                  {l.extras.length > 0 && (
                    <span className="block text-xs text-brand-dark/50">+ {l.extras.map((e) => e.name).join(", ")}</span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-brand-pink">{fmt(lineTotal({ unitPrice: l.price, quantity: l.quantity, extras: l.extras }))}</span>
                  <button type="button" onClick={() => setLines((prev) => prev.filter((x) => lineKey(x.productId, x.extras) !== key))}
                    aria-label={`Quitar ${l.name}`} className="p-1 rounded-lg text-brand-dark/40 hover:bg-brand-muted/30">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="sticky bottom-0 bg-white pt-3 border-t border-brand-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-sm text-brand-dark/60">
          {lines.length > 0
            ? `${lines.reduce((s, l) => s + l.quantity, 0)} producto${lines.reduce((s, l) => s + l.quantity, 0) !== 1 ? "s" : ""} · ${fmt(total)}`
            : "Elegí lo que faltó anotar."}
        </span>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="cancel" className="flex-1 sm:flex-none" onClick={onCancel} disabled={saving}>Volver</Button>
          <Button type="button" className="flex-1 sm:flex-none" onClick={submit} disabled={saving || lines.length === 0}>
            {saving ? "Agregando..." : `Agregar a #${comandaNumber}`}
          </Button>
        </div>
      </div>
    </>
  );
}
