"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { IProduct } from "@/models/Product";
import type { IOrderItem } from "@/models/Order";
import { Plus, X, Check } from "lucide-react";
import CustomerCombobox from "@/components/admin/CustomerCombobox";
import DateTime12hInput from "@/components/admin/DateTime12hInput";
import { offerLineTotal, type LineExtra } from "@/lib/pricing";

interface LineItemState {
  productId: string;
  quantity:  number;
  extras:    LineExtra[];   // copia de los extras elegidos (aplican a todas las unidades)
  saved?:    { productName: string; price: number };  // copia del pedido, por si el producto ya no está en el catálogo
}

type LineProduct = Pick<IProduct, "name" | "price"> & Partial<Pick<IProduct, "offers" | "extras">>;

interface OrderFormProps {
  initial?: {
    customerName?: string;
    phone?:        string;
    paid?:         boolean;
    orderedAt?:    Date | string;
    notes?:        string;
    total?:        number;
    // Nuevo formato
    items?:        IOrderItem[];
    // Legacy (editar pedidos viejos)
    productId?:    string;
    productName?:  string;
    quantity?:     number;
    options?:      string[];
  };
  onSave:   (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  saving?:  boolean;
}

/** Misma fórmula que la tienda: oferta por volumen sobre el precio base + extras por unidad. */
function calcSubtotal(item: LineItemState, product: LineProduct): number {
  return offerLineTotal({ unitPrice: product.price, quantity: item.quantity, extras: item.extras }, product.offers);
}

/** Pedidos viejos guardaban toppings sueltos por unidad; se recuperan como extras del producto por nombre. */
function legacyExtras(names: string[], product: IProduct | undefined): LineExtra[] {
  const unique = Array.from(new Set(names));
  return unique.map((name) => product?.extras?.find((e) => e.name === name) ?? { name, price: 0 });
}

export default function OrderForm({ initial, onSave, onCancel, saving }: OrderFormProps) {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [form, setForm] = useState({
    customerName: initial?.customerName ?? "",
    phone:        initial?.phone        ?? "",
    paid:         initial?.paid         ?? false,
    orderedAt:    initial?.orderedAt
      ? new Date(initial.orderedAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    notes:        initial?.notes ?? "",
  });
  const [manualTotal, setManualTotal] = useState<string | null>(null);
  // Al editar, lo guardado manda hasta que se toque algún producto: se muestra el total del pedido
  // (pudo haberse ajustado a mano) y al guardar no se reescriben sus líneas con los precios de hoy.
  const [linesChanged, setLinesChanged] = useState(false);

  // Inicializar líneas de pedido (los toppings de pedidos viejos se completan cuando llega el catálogo)
  const [lineItems, setLineItems] = useState<LineItemState[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      return initial.items.map(it => ({
        productId: it.productId,
        quantity:  it.quantity,
        extras:    it.extras ?? [],
        saved:     { productName: it.productName, price: it.price },
      }));
    }
    // Legacy: convertir pedido viejo a línea única
    if (initial?.productId) {
      return [{ productId: initial.productId, quantity: initial.quantity ?? 1, extras: [] }];
    }
    return [{ productId: "", quantity: 1, extras: [] }];
  });

  useEffect(() => {
    fetch("/api/admin/products")
      .then(r => r.json())
      .then(d => {
        const list: IProduct[] = d.products ?? [];
        setProducts(list);
        setCatalogLoaded(Array.isArray(d.products));
        // Pedidos anteriores a los extras: sus toppings (por unidad) pasan a ser extras de la línea.
        setLineItems(prev => prev.map((line, i) => {
          if (line.extras.length > 0) return line;
          const legacy = initial?.items?.[i]?.itemToppings?.flat()
            ?? (i === 0 && !initial?.items?.length ? initial?.options : undefined) ?? [];
          if (legacy.length === 0) return line;
          return { ...line, extras: legacyExtras(legacy, list.find(p => String(p._id) === line.productId)) };
        }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────
  /** Producto que se borró del catálogo después del pedido: se sigue mostrando con su copia guardada. */
  function goneProduct(item: LineItemState): LineProduct | null {
    if (!catalogLoaded || !item.productId || !item.saved) return null;
    if (products.some(p => String(p._id) === item.productId)) return null;
    return { name: item.saved.productName, price: item.saved.price };
  }

  function lineProduct(item: LineItemState): LineProduct | null {
    return products.find(p => String(p._id) === item.productId) ?? goneProduct(item);
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { productId: "", quantity: 1, extras: [] }]);
  }

  function removeLineItem(idx: number) {
    setLinesChanged(true);
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function setLineProduct(idx: number, productId: string) {
    setLinesChanged(true);
    setLineItems(prev => prev.map((item, i) =>
      i !== idx ? item : { productId, quantity: item.quantity, extras: [] }
    ));
  }

  function setLineQty(idx: number, newQty: number) {
    const q = Math.max(1, newQty);
    setLinesChanged(true);
    setLineItems(prev => prev.map((item, i) => (i !== idx ? item : { ...item, quantity: q })));
  }

  function toggleExtra(lineIdx: number, extra: LineExtra) {
    setLinesChanged(true);
    setLineItems(prev => prev.map((item, i) => {
      if (i !== lineIdx) return item;
      const has = item.extras.some(e => e.name === extra.name);
      return {
        ...item,
        extras: has ? item.extras.filter(e => e.name !== extra.name) : [...item.extras, { name: extra.name, price: extra.price }],
      };
    }));
  }

  // ── Precio calculado ────────────────────────────────────────────
  const computedTotal = lineItems.reduce((sum, item) => {
    const prod = lineProduct(item);
    return prod ? sum + calcSubtotal(item, prod) : sum;
  }, 0);

  const savedTotal = linesChanged ? undefined : initial?.total;
  const autoTotal = savedTotal ?? computedTotal;
  const displayTotal = manualTotal !== null ? manualTotal : autoTotal.toString();

  // ── Submit ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = lineItems.filter(i => i.productId);
    if (validItems.length === 0) return;
    const total = Number(manualTotal !== null ? manualTotal : autoTotal);

    // Productos sin tocar: las líneas se quedan como se guardaron (nombres, precios y extras de ese día).
    if (savedTotal !== undefined) {
      await onSave({ ...form, total });
      return;
    }

    const builtItems = validItems.map(item => {
      const prod = lineProduct(item)!;
      return {
        productId:   item.productId,
        productName: prod.name,
        price:       prod.price,
        quantity:    item.quantity,
        extras:      item.extras,
        subtotal:    calcSubtotal(item, prod),
      };
    });

    await onSave({
      ...form,
      items: builtItems,
      total,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Cliente ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Nombre cliente *</label>
          <CustomerCombobox
            value={form.customerName}
            onChangeName={name => setForm(f => ({ ...f, customerName: name }))}
            onSelectCustomer={(name, phone) => setForm(f => ({ ...f, customerName: name, phone }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Teléfono *</label>
          <input
            type="text" required
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
      </div>

      {/* ── Productos del pedido ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-brand-dark">Productos *</label>
          <button
            type="button"
            onClick={addLineItem}
            className="text-xs text-brand-pink hover:text-brand-orange font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar producto
          </button>
        </div>

        <div className="space-y-3">
          {lineItems.map((item, lineIdx) => {
            const gone = goneProduct(item);
            const prod = lineProduct(item);
            const subtotal = prod ? calcSubtotal(item, prod) : 0;
            const activeOffer = prod?.offers?.find(o => o.qty === item.quantity);
            // Extras del catálogo + los ya elegidos que ya no estén en el catálogo (se pueden quitar).
            const extraOptions = [
              ...(prod?.extras ?? []),
              ...item.extras.filter(e => !(prod?.extras ?? []).some(c => c.name === e.name)),
            ];

            return (
              <div key={lineIdx} className="border border-brand-muted rounded-xl p-3 space-y-3">
                {/* Selector de producto + stepper + subtotal */}
                <div className="flex items-center gap-2">
                  <select
                    required
                    value={item.productId}
                    onChange={e => setLineProduct(lineIdx, e.target.value)}
                    className="flex-1 min-w-0 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                  >
                    <option value="">Seleccionar...</option>
                    {gone && (
                      <option value={item.productId}>{gone.name} (ya no está en el catálogo)</option>
                    )}
                    {products.map(p => (
                      <option key={String(p._id)} value={String(p._id)}>
                        {p.name} — ₡{p.price.toLocaleString("es-CR")}
                      </option>
                    ))}
                  </select>

                  {/* Stepper qty */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setLineQty(lineIdx, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="w-7 h-7 rounded-full border border-brand-muted flex items-center justify-center text-brand-dark font-bold hover:border-brand-pink transition-colors disabled:opacity-40"
                    >−</button>
                    <span className="w-5 text-center text-sm font-bold text-brand-dark">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setLineQty(lineIdx, item.quantity + 1)}
                      className="w-7 h-7 rounded-full border border-brand-muted flex items-center justify-center text-brand-dark font-bold hover:border-brand-pink transition-colors"
                    >+</button>
                  </div>

                  {/* Subtotal */}
                  {prod && (
                    <span className="text-sm font-semibold text-brand-dark shrink-0 w-20 text-right">
                      ₡{subtotal.toLocaleString("es-CR")}
                    </span>
                  )}

                  {/* Quitar línea */}
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="destructive"
                      className="shrink-0"
                      title="Quitar producto"
                      aria-label="Quitar producto"
                      onClick={() => removeLineItem(lineIdx)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Oferta activa */}
                {activeOffer && prod && (
                  <p className="text-xs text-emerald-600 font-medium px-1">
                    🏷️ Oferta {activeOffer.qty}× · ₡{activeOffer.price.toLocaleString("es-CR")}
                    {" "}
                    <span className="text-brand-dark/30 line-through">
                      ₡{(prod.price * item.quantity).toLocaleString("es-CR")}
                    </span>
                  </p>
                )}

                {/* Extras con precio (aplican a todas las unidades de la línea) */}
                {prod && extraOptions.length > 0 && (
                  <div>
                    <p className="text-xs text-brand-dark/50 mb-2">
                      Extras{item.quantity > 1 ? ` · se suman a cada una de las ${item.quantity} unidades` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {extraOptions.map(extra => {
                        const selected = item.extras.some(e => e.name === extra.name);
                        return (
                          <button
                            key={extra.name} type="button"
                            role="checkbox" aria-checked={selected}
                            onClick={() => toggleExtra(lineIdx, extra)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all ${
                              selected
                                ? "gradient-bg text-white border-transparent"
                                : "bg-brand-muted border-brand-muted text-brand-dark/70 hover:border-brand-pink/30"
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                            {extra.name}
                            <span className={selected ? "text-white/80" : "text-brand-dark/50"}>
                              {extra.price > 0 ? `+₡${extra.price.toLocaleString("es-CR")}` : "₡0"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Total + Fecha ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">
            Total (₡) *
            {manualTotal === null && (savedTotal !== undefined || computedTotal > 0) && (
              <span className="text-brand-dark/40 font-normal ml-1 text-xs">
                ({savedTotal !== undefined ? "guardado" : "calculado"})
              </span>
            )}
          </label>
          <input
            type="number" required min={0}
            value={displayTotal}
            onChange={e => setManualTotal(e.target.value)}
            onFocus={() => { if (manualTotal === null) setManualTotal(autoTotal.toString()); }}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Fecha y hora</label>
          <DateTime12hInput value={form.orderedAt} onChange={v => setForm({ ...form, orderedAt: v })} />
        </div>
      </div>

      {/* ── Notas ── */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Notas</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
        />
      </div>

      {/* ── Pagado ── */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox" id="paid"
          checked={form.paid}
          onChange={e => setForm({ ...form, paid: e.target.checked })}
        />
        <label htmlFor="paid" className="text-sm text-brand-dark">Marcar como pagado</label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Guardando..." : initial?.customerName ? "Actualizar pedido" : "Registrar pedido"}
        </Button>
        <Button type="button" variant="cancel" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
