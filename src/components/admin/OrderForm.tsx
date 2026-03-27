"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IProduct } from "@/models/Product";
import { IOrderItem } from "@/models/Order";
import { Plus, X, ChevronDown } from "lucide-react";
import CustomerCombobox from "@/components/admin/CustomerCombobox";

const FREE_TOPPINGS   = 2;
const EXTRA_TOPPING_PRICE = 150;

interface LineItemState {
  productId:    string;
  quantity:     number;
  itemToppings: string[][];   // toppings por unidad
  openUnitIdx:  number | null;
}

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

function calcSubtotal(item: LineItemState, product: IProduct): number {
  const offers = (product as IProduct & { offers?: { qty: number; price: number }[] }).offers ?? [];
  const activeOffer = offers.find(o => o.qty === item.quantity);
  const base  = activeOffer ? activeOffer.price : product.price * item.quantity;
  const extra = item.itemToppings.reduce(
    (sum, tops) => sum + Math.max(0, tops.length - FREE_TOPPINGS), 0
  );
  return base + extra * EXTRA_TOPPING_PRICE;
}

function resizeToppings(prev: string[][], newQty: number): string[][] {
  const next = [...prev];
  while (next.length < newQty) next.push([]);
  return next.slice(0, newQty);
}

export default function OrderForm({ initial, onSave, onCancel, saving }: OrderFormProps) {
  const [products, setProducts] = useState<IProduct[]>([]);
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

  // Inicializar líneas de pedido
  const [lineItems, setLineItems] = useState<LineItemState[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      return initial.items.map(it => ({
        productId:    it.productId,
        quantity:     it.quantity,
        itemToppings: it.itemToppings?.length ? it.itemToppings : Array.from({ length: it.quantity }, () => []),
        openUnitIdx:  null,
      }));
    }
    // Legacy: convertir pedido viejo a línea única
    if (initial?.productId) {
      const qty = initial.quantity ?? 1;
      const tops = initial.options ?? [];
      return [{
        productId:    initial.productId,
        quantity:     qty,
        itemToppings: Array.from({ length: qty }, (_, i) => (i === 0 ? tops : [])),
        openUnitIdx:  null,
      }];
    }
    return [{ productId: "", quantity: 1, itemToppings: [[]], openUnitIdx: null }];
  });

  useEffect(() => {
    fetch("/api/admin/products")
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []));
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────
  function addLineItem() {
    setLineItems(prev => [...prev, { productId: "", quantity: 1, itemToppings: [[]], openUnitIdx: null }]);
  }

  function removeLineItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function setLineProduct(idx: number, productId: string) {
    setLineItems(prev => prev.map((item, i) =>
      i !== idx ? item : { ...item, productId, itemToppings: resizeToppings([[]], item.quantity), openUnitIdx: null }
    ));
  }

  function setLineQty(idx: number, newQty: number) {
    const q = Math.max(1, newQty);
    setLineItems(prev => prev.map((item, i) =>
      i !== idx ? item : { ...item, quantity: q, itemToppings: resizeToppings(item.itemToppings, q) }
    ));
  }

  function toggleUnitTopping(lineIdx: number, unitIdx: number, topping: string) {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== lineIdx) return item;
      const tops = [...item.itemToppings];
      tops[unitIdx] = tops[unitIdx].includes(topping)
        ? tops[unitIdx].filter(t => t !== topping)
        : [...tops[unitIdx], topping];
      return { ...item, itemToppings: tops };
    }));
  }

  function toggleAccordion(lineIdx: number, unitIdx: number) {
    setLineItems(prev => prev.map((item, i) =>
      i !== lineIdx ? item : {
        ...item,
        openUnitIdx: item.openUnitIdx === unitIdx ? null : unitIdx,
      }
    ));
  }

  // ── Precio calculado ────────────────────────────────────────────
  const computedTotal = lineItems.reduce((sum, item) => {
    const prod = products.find(p => String(p._id) === item.productId);
    return prod ? sum + calcSubtotal(item, prod) : sum;
  }, 0);

  const displayTotal = manualTotal !== null ? manualTotal : computedTotal.toString();

  // ── Submit ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = lineItems.filter(i => i.productId);
    if (validItems.length === 0) return;

    const builtItems = validItems.map(item => {
      const prod = products.find(p => String(p._id) === item.productId)!;
      return {
        productId:    item.productId,
        productName:  prod.name,
        price:        prod.price,
        quantity:     item.quantity,
        itemToppings: item.itemToppings,
        subtotal:     calcSubtotal(item, prod),
      };
    });

    await onSave({
      ...form,
      items: builtItems,
      total: Number(manualTotal !== null ? manualTotal : computedTotal),
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
            const prod = products.find(p => String(p._id) === item.productId) ?? null;
            const subtotal = prod ? calcSubtotal(item, prod) : 0;
            const offers = (prod as (IProduct & { offers?: { qty: number; price: number }[] }) | null)?.offers ?? [];
            const activeOffer = offers.find(o => o.qty === item.quantity);

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
                    <button
                      type="button"
                      onClick={() => removeLineItem(lineIdx)}
                      className="p-1 text-brand-dark/30 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
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

                {/* Toppings — qty = 1: inline */}
                {prod && prod.toppings.length > 0 && item.quantity === 1 && (
                  <div>
                    <p className="text-xs text-brand-dark/50 mb-2">
                      Toppings · {FREE_TOPPINGS} incluidos · +₡{EXTRA_TOPPING_PRICE} c/u extra
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {prod.toppings.map(t => {
                        const selected = item.itemToppings[0]?.includes(t);
                        return (
                          <button
                            key={t} type="button"
                            onClick={() => toggleUnitTopping(lineIdx, 0, t)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                              selected
                                ? "gradient-bg text-white border-transparent"
                                : "bg-brand-muted border-brand-muted text-brand-dark/70 hover:border-brand-pink/30"
                            }`}
                          >{t}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Toppings — qty > 1: acordeón por unidad */}
                {prod && prod.toppings.length > 0 && item.quantity > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs text-brand-dark/50 mb-1">
                      Personaliza cada unidad · {FREE_TOPPINGS} toppings incluidos · +₡{EXTRA_TOPPING_PRICE} c/u extra
                    </p>
                    {Array.from({ length: item.quantity }, (_, unitIdx) => {
                      const unitTops = item.itemToppings[unitIdx] ?? [];
                      const extraCount = Math.max(0, unitTops.length - FREE_TOPPINGS);
                      const isOpen = item.openUnitIdx === unitIdx;
                      const shortName = prod.name.split(" ").slice(-1)[0];
                      return (
                        <div key={unitIdx} className="border border-brand-muted/60 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleAccordion(lineIdx, unitIdx)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-brand-muted/30 transition-colors"
                          >
                            <span className="text-xs font-medium text-brand-dark">
                              {shortName} #{unitIdx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {unitTops.length > 0 && (
                                <span className="text-xs text-brand-pink/80">
                                  {unitTops.length} topping{unitTops.length !== 1 ? "s" : ""}
                                  {extraCount > 0 && (
                                    <span className="font-semibold">
                                      {" "}(+₡{(extraCount * EXTRA_TOPPING_PRICE).toLocaleString("es-CR")})
                                    </span>
                                  )}
                                </span>
                              )}
                              <ChevronDown className={`w-3.5 h-3.5 text-brand-dark/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-3 pb-3 pt-1 border-t border-brand-muted/40">
                              <div className="flex flex-wrap gap-1.5">
                                {prod.toppings.map(t => {
                                  const selected = unitTops.includes(t);
                                  return (
                                    <button
                                      key={t} type="button"
                                      onClick={() => toggleUnitTopping(lineIdx, unitIdx, t)}
                                      className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                                        selected
                                          ? "gradient-bg text-white border-transparent"
                                          : "bg-brand-muted border-brand-muted text-brand-dark/70 hover:border-brand-pink/30"
                                      }`}
                                    >{t}</button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
            {manualTotal === null && computedTotal > 0 && (
              <span className="text-brand-dark/40 font-normal ml-1 text-xs">(calculado)</span>
            )}
          </label>
          <input
            type="number" required min={0}
            value={displayTotal}
            onChange={e => setManualTotal(e.target.value)}
            onFocus={() => { if (manualTotal === null) setManualTotal(computedTotal.toString()); }}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Fecha y hora</label>
          <input
            type="datetime-local"
            value={form.orderedAt}
            onChange={e => setForm({ ...form, orderedAt: e.target.value })}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
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
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
