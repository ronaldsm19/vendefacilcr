"use client";

import { useEffect, useRef, useState } from "react";
import StatsCard from "@/components/admin/StatsCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  AlertTriangle,
  Package,
  Check,
  X,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { IRawMaterial, RawMaterialType } from "@/models/RawMaterial";

type MaterialRow = IRawMaterial & { _id: string };

const typeLabel: Record<RawMaterialType, string> = {
  ingrediente: "Ingrediente",
  empaque:     "Empaque",
  topping:     "Topping",
};

const typeBadgeColor: Record<RawMaterialType, string> = {
  ingrediente: "bg-blue-50 text-blue-600",
  empaque:     "bg-purple-50 text-purple-600",
  topping:     "bg-amber-50 text-amber-600",
};

const emptyForm = {
  name:        "",
  type:        "ingrediente" as RawMaterialType,
  unit:        "",
  stock:       "",
  minStock:    "",
  costPerUnit: "",
  notes:       "",
};

export default function AdminMaterialesPage() {
  const [materials, setMaterials]         = useState<MaterialRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filterType, setFilterType]       = useState<"all" | RawMaterialType>("all");
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editValue, setEditValue]         = useState("");
  const [saving, setSaving]               = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [formEditing, setFormEditing]     = useState<MaterialRow | null>(null);
  const [form, setForm]                   = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/admin/materials");
    const d = await r.json();
    setMaterials(d.materials ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  function startEdit(m: MaterialRow) {
    setEditingId(m._id);
    setEditValue(String(m.stock ?? 0));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function handleStockSave(id: string) {
    const newStock = parseFloat(editValue);
    if (isNaN(newStock) || newStock < 0) return;
    setSaving(true);
    await fetch(`/api/admin/materials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: newStock }),
    });
    await load();
    setSaving(false);
    setEditingId(null);
  }

  function openCreate() {
    setFormEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(m: MaterialRow) {
    setFormEditing(m);
    setForm({
      name:        m.name,
      type:        m.type,
      unit:        m.unit,
      stock:       String(m.stock ?? 0),
      minStock:    String(m.minStock ?? 0),
      costPerUnit: m.costPerUnit !== undefined ? String(m.costPerUnit) : "",
      notes:       m.notes ?? "",
    });
    setShowForm(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name:        form.name,
      type:        form.type,
      unit:        form.unit,
      stock:       parseFloat(form.stock) || 0,
      minStock:    parseFloat(form.minStock) || 0,
      costPerUnit: form.costPerUnit !== "" ? parseFloat(form.costPerUnit) : undefined,
      notes:       form.notes || undefined,
    };

    if (formEditing) {
      await fetch(`/api/admin/materials/${formEditing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/admin/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    await load();
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/materials/${id}`, { method: "DELETE" });
    await load();
    setConfirmDelete(null);
  }

  const filtered = filterType === "all"
    ? materials
    : materials.filter(m => m.type === filterType);

  const lowStockCount = materials.filter(
    m => (m.stock ?? 0) > 0 && (m.minStock ?? 0) > 0 && (m.stock ?? 0) <= (m.minStock ?? 0)
  ).length;
  const outOfStock = materials.filter(m => (m.stock ?? 0) === 0).length;

  const typeBreakdown = (["ingrediente", "empaque", "topping"] as RawMaterialType[])
    .map(t => `${materials.filter(m => m.type === t).length} ${typeLabel[t].toLowerCase()}s`)
    .join(" · ");

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Materiales</h1>
          <p className="text-brand-dark/50 text-sm mt-1">{materials.length} materiales registrados</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo material
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatsCard
          label="Total materiales"
          value={materials.length}
          icon={FlaskConical}
          color="pink"
          sub={typeBreakdown}
        />
        <StatsCard
          label="Stock bajo"
          value={lowStockCount}
          icon={AlertTriangle}
          color="orange"
          sub="Por debajo del mínimo"
        />
        <StatsCard
          label="Sin stock"
          value={outOfStock}
          icon={Package}
          color="orange"
          sub="Necesitan reposición"
        />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "ingrediente", "empaque", "topping"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === t
                ? "gradient-bg text-white"
                : "bg-white border border-brand-muted text-brand-dark/60 hover:border-brand-pink"
            }`}
          >
            {t === "all" ? "Todos" : typeLabel[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Tipo</th>
                  <th className="text-left px-4 py-3">Unidad</th>
                  <th className="text-left px-4 py-3">Stock</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Mín.</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Costo/u</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Estado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const stock    = m.stock ?? 0;
                  const minStock = m.minStock ?? 0;
                  const isLow    = stock > 0 && minStock > 0 && stock <= minStock;
                  const isEmpty  = stock === 0;

                  return (
                    <tr key={m._id} className="border-b border-brand-muted/50 hover:bg-brand-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-dark">{m.name}</p>
                        {m.notes && (
                          <p className="text-xs text-brand-dark/40 mt-0.5 line-clamp-1">{m.notes}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColor[m.type]}`}>
                          {typeLabel[m.type]}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-brand-dark/60 text-xs">
                        {m.unit}
                      </td>

                      <td className="px-4 py-3">
                        {editingId === m._id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              ref={inputRef}
                              type="number"
                              min={0}
                              step="0.001"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")  handleStockSave(m._id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="w-20 border border-brand-pink rounded-lg px-2 py-1 text-sm focus:outline-none"
                            />
                            <button
                              onClick={() => handleStockSave(m._id)}
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
                            onClick={() => startEdit(m)}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-70 ${
                              isEmpty ? "bg-red-50 text-red-500"
                              : isLow  ? "bg-yellow-50 text-amber-600"
                              : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {stock}
                          </button>
                        )}
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell text-brand-dark/50 text-xs">
                        {minStock > 0 ? minStock : "—"}
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell text-brand-dark/60 text-xs">
                        {m.costPerUnit !== undefined
                          ? `₡${m.costPerUnit.toLocaleString("es-CR")}`
                          : "—"}
                      </td>

                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isEmpty ? "bg-red-50 text-red-500"
                          : isLow  ? "bg-yellow-50 text-amber-600"
                          : "bg-emerald-50 text-emerald-600"
                        }`}>
                          {isEmpty ? "Sin stock" : isLow ? "Stock bajo" : "OK"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(m)}
                            className="p-1.5 rounded-lg text-brand-dark/40 hover:text-brand-pink hover:bg-brand-pink/5 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(m._id)}
                            className="p-1.5 rounded-lg text-brand-dark/40 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-brand-dark/40">
                      {materials.length === 0
                        ? "No hay materiales. Agregá el primero."
                        : "No hay materiales con ese filtro."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formEditing ? "Editar material" : "Nuevo material"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="px-6 pb-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-brand-dark mb-1">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Leche condensada"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm(f => ({ ...f, type: e.target.value as RawMaterialType }))}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white"
                >
                  <option value="ingrediente">Ingrediente</option>
                  <option value="empaque">Empaque</option>
                  <option value="topping">Topping</option>
                </select>
              </div>

              {/* Unidad */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">
                  Unidad de medida <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  list="unit-suggestions"
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="Ej: litros"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
                <datalist id="unit-suggestions">
                  <option value="unidades" />
                  <option value="litros" />
                  <option value="ml" />
                  <option value="gramos" />
                  <option value="kg" />
                  <option value="latas" />
                  <option value="paquetes" />
                  <option value="cucharadas" />
                  <option value="bolsas" />
                </datalist>
              </div>

              {/* Stock (only on create) */}
              {!formEditing && (
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1">Stock inicial</label>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={form.stock}
                    onChange={(e) => setForm(f => ({ ...f, stock: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                  />
                </div>
              )}

              {/* Min Stock */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Stock mínimo</label>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={form.minStock}
                  onChange={(e) => setForm(f => ({ ...f, minStock: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>

              {/* Costo por unidad */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Costo por unidad (₡)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.costPerUnit}
                  onChange={(e) => setForm(f => ({ ...f, costPerUnit: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>

              {/* Notas */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-brand-dark mb-1">Notas</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ej: 2 unidades de 304 ml"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} onClick={(e) => {
              e.preventDefault();
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              handleFormSubmit(fakeEvent);
            }}>
              {saving ? "Guardando..." : formEditing ? "Guardar cambios" : "Crear material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar material</DialogTitle>
          </DialogHeader>
          <p className="px-6 py-2 text-sm text-brand-dark/70">
            ¿Seguro que querés eliminar este material? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
