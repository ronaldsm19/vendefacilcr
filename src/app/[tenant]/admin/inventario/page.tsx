"use client";

import { useEffect, useState, useRef } from "react";
import StatsCard from "@/components/admin/StatsCard";
import { IProduct } from "@/models/Product";
import { Package, TrendingUp, AlertTriangle, ShoppingBag, Check, X } from "lucide-react";

type ProductRow = IProduct & { _id: string };

const catLabel: Record<string, string> = {
  gelatina: "Gelatina",
  apretado: "Apretado",
  especial: "Especial",
};

export default function AdminInventarioPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/admin/products");
    const d = await r.json();
    setProducts(d.products ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  function startEdit(p: ProductRow) {
    setEditingId(p._id);
    setEditValue(String(p.stock ?? 0));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function handleStockSave(id: string) {
    const newStock = parseInt(editValue, 10);
    if (isNaN(newStock) || newStock < 0) return;
    setSaving(true);
    await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: newStock }),
    });
    await load();
    setSaving(false);
    setEditingId(null);
  }

  const totalUnits    = products.reduce((s, p) => s + (p.stock ?? 0), 0);
  const totalSold     = products.reduce((s, p) => s + (p.sold ?? 0), 0);
  const totalRevenue  = products.reduce((s, p) => s + (p.stock ?? 0) * p.price, 0);
  const lowStockCount = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 3).length;
  const outOfStock    = products.filter(p => (p.stock ?? 0) === 0).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Inventario</h1>
        <p className="text-brand-dark/50 text-sm mt-1">{products.length} productos en catálogo</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          label="Unidades en stock"
          value={totalUnits}
          icon={Package}
          color="pink"
          sub={`${outOfStock} sin stock`}
        />
        <StatsCard
          label="Unidades vendidas"
          value={totalSold}
          icon={ShoppingBag}
          color="green"
          sub="Total acumulado"
        />
        <StatsCard
          label="Ingresos potenciales"
          value={`₡${totalRevenue.toLocaleString("es-CR")}`}
          icon={TrendingUp}
          color="green"
          sub="Si se vende todo"
        />
        <StatsCard
          label="Stock bajo"
          value={lowStockCount}
          icon={AlertTriangle}
          color="orange"
          sub="Productos con 1–3 unidades"
        />
      </div>

      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Categoría</th>
                  <th className="text-left px-4 py-3">Precio</th>
                  <th className="text-left px-4 py-3">Stock</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Vendidos</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Ingreso potencial</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Estado</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p._id} className="border-b border-brand-muted/50 hover:bg-brand-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-dark">{p.name}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="px-2 py-0.5 rounded-full bg-brand-muted text-brand-dark/60 text-xs">
                        {catLabel[p.category] ?? p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-dark">
                      ₡{p.price.toLocaleString("es-CR")}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === p._id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={inputRef}
                            type="number"
                            min={0}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleStockSave(p._id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-20 border border-brand-pink rounded-lg px-2 py-1 text-sm focus:outline-none"
                          />
                          <button
                            onClick={() => handleStockSave(p._id)}
                            disabled={saving}
                            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 rounded-lg text-brand-dark/40 hover:bg-brand-muted transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(p)}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-70 ${
                            (p.stock ?? 0) === 0 ? "bg-red-50 text-red-500"
                            : (p.stock ?? 0) <= 3 ? "bg-yellow-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {p.stock ?? 0}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-muted text-brand-dark/70">
                        {p.sold ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-brand-dark/60">
                      {(p.stock ?? 0) > 0
                        ? `₡${((p.stock ?? 0) * p.price).toLocaleString("es-CR")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.available ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                      }`}>
                        {p.available ? "Disponible" : "No disponible"}
                      </span>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-brand-dark/40">
                      No hay productos en el catálogo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
