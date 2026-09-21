"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import ProductForm from "@/components/admin/ProductForm";
import Pagination from "@/components/admin/Pagination";
import { IProduct } from "@/models/Product";
import { Plus, Pencil, Trash2, Search, Upload, UtensilsCrossed, Loader2 } from "lucide-react";
import ImportProductsModal from "@/components/admin/ImportProductsModal";
import { useAdminSession } from "@/components/admin/SessionContext";
import { can } from "@/lib/permissions";
import { STATIONS, STATION_LABELS, effectiveStation, type ProductStation } from "@/lib/station";
import { orderCategories, type CategoryOrderEntry } from "@/lib/categories";

type ProductRow = IProduct & { _id: string; stationAssigned?: boolean };

const catLabel: Record<string, string> = {
  gelatina: "Gelatina",
  apretado: "Apretado",
  especial: "Especial",
};

const STATION_BADGE: Record<ProductStation, string> = {
  cocina: "bg-orange-50 text-orange-600",
  bebidas: "bg-blue-50 text-blue-600",
  ninguna: "bg-brand-muted text-brand-dark/50",
};

export default function AdminProductsPage() {
  const session = useAdminSession();
  const canEdit = can(session, "productos:editar");
  const isPremium = session.isPremium;
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<CategoryOrderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showStationDialog, setShowStationDialog] = useState(false);
  const [stationCategory, setStationCategory] = useState("");
  const [stationValue, setStationValue] = useState<ProductStation>("cocina");
  const [applyingStation, setApplyingStation] = useState(false);
  const [stationResult, setStationResult] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState("");

  async function load() {
    const [r, catsRes] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/categories").catch(() => null),
    ]);
    const d = await r.json();
    setProducts(d.products ?? []);
    if (catsRes) {
      const catsData = await catsRes.json().catch(() => ({}));
      setCategoryOrder(catsData.categories ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: Partial<IProduct>) {
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/admin/products/${editing._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(p: ProductRow) { setEditing(p); setShowForm(true); }

  const categories = orderCategories(categoryOrder, products.map((p) => p.category));
  const unassignedCount = products.filter((p) => p.stationAssigned === false).length;

  async function applyStationByCategory() {
    if (!stationCategory) return;
    setApplyingStation(true);
    setStationResult("");
    try {
      const res = await fetch("/api/admin/products/bulk-station", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: stationCategory, station: stationValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setStationResult(`${data.modified} productos actualizados`);
        await load();
      } else {
        setStationResult(data.error ?? "No se pudo aplicar");
      }
    } finally {
      setApplyingStation(false);
    }
  }

  async function runMigrateStations() {
    setMigrating(true);
    setMigrateResult("");
    try {
      const res = await fetch("/api/admin/products/migrate-stations", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMigrateResult(`Cocina: ${data.updated.cocina} · Bebidas: ${data.updated.bebidas}`);
        await load();
      } else {
        setMigrateResult(data.error ?? "No se pudo migrar");
      }
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Productos</h1>
          <p className="text-brand-dark/50 text-sm mt-1">
            {products.length} productos en catálogo{!canEdit && " · Solo lectura"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-dark/30" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-1.5 border border-brand-muted rounded-full text-sm focus:outline-none focus:border-brand-pink w-48"
            />
          </div>
          {canEdit && isPremium && (
            <Button variant="secondary" size="sm" onClick={() => { setShowStationDialog(true); setStationResult(""); }} className="shrink-0">
              <UtensilsCrossed className="w-4 h-4" /> Estación por categoría
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)} className="shrink-0">
                <Upload className="w-4 h-4" /> Importar
              </Button>
              <Button onClick={openCreate} className="shrink-0">
                <Plus className="w-4 h-4 mr-1" /> Nuevo
              </Button>
            </>
          )}
        </div>
      </div>

      {canEdit && isPremium && unassignedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span>
            Hay {unassignedCount} producto{unassignedCount !== 1 ? "s" : ""} sin estación asignada. Se tratan como Cocina
            (o Bebidas si están en la sección Bebidas del menú).
            {migrateResult && <span className="block font-medium mt-1">{migrateResult}</span>}
          </span>
          <Button size="sm" disabled={migrating} onClick={runMigrateStations}>
            {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Asignar ahora"}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : (
        (() => {
          const filtered = products.filter(p =>
            !search.trim() ||
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.category.toLowerCase().includes(search.toLowerCase())
          );
          const totalPagesP = Math.max(1, Math.ceil(filtered.length / pageSize));
          const safePg      = Math.min(page, totalPagesP);
          const pageItems   = filtered.slice((safePg - 1) * pageSize, safePg * pageSize);

          return (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Categoría</th>
                {isPremium && <th className="text-left px-4 py-3 hidden md:table-cell">Estación</th>}
                <th className="text-left px-4 py-3">Precio</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Stock</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Estado</th>
                {canEdit && <th className="text-right px-4 py-3">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p._id} className="border-b border-brand-muted/50 hover:bg-brand-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-brand-muted flex items-center justify-center">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt={p.name}
                            width={40} height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">🍽️</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-brand-dark">{p.name}</p>
                          {p.featured && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange font-semibold shrink-0">
                              🔥 Destacado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-brand-dark/40 line-clamp-1">{p.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="px-2 py-0.5 rounded-full bg-brand-muted text-brand-dark/60 text-xs">
                      {catLabel[p.category] ?? p.category}
                    </span>
                  </td>
                  {isPremium && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATION_BADGE[effectiveStation(p)]}`}>
                        {STATION_LABELS[effectiveStation(p)]}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 font-semibold text-brand-dark">
                    ₡{p.price.toLocaleString("es-CR")}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      (p.stock ?? 0) === 0 ? "bg-red-50 text-red-500"
                      : (p.stock ?? 0) <= 3 ? "bg-yellow-50 text-amber-600"
                      : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {p.stock ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.available ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                    }`}>
                      {p.available ? "Disponible" : "No disponible"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/50 hover:text-brand-pink transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/50 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={5 + (isPremium ? 1 : 0) + (canEdit ? 1 : 0)} className="px-4 py-8 text-center text-brand-dark/40">
                    {search ? "Sin resultados para esa búsqueda." : "No hay productos. Crea el primero."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <Pagination
            page={safePg}
            totalPages={totalPagesP}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={s => { setPageSize(s); setPage(1); }}
            totalItems={filtered.length}
          />
        </div>
          );
        })()
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4">
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ProductForm
              initial={editing ?? undefined}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              saving={saving}
              showStation={isPremium}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2">
            <DialogTitle>¿Eliminar producto?</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-brand-dark/60">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 bg-red-50 text-red-600 hover:bg-red-100"
                onClick={() => confirmDelete && handleDelete(confirmDelete)}
              >
                Eliminar
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Estación por categoría */}
      <Dialog open={showStationDialog} onOpenChange={(v) => { if (!v) setShowStationDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar estación por categoría</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Categoría</label>
              <select
                value={stationCategory}
                onChange={(e) => setStationCategory(e.target.value)}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              >
                <option value="">Seleccioná una categoría</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{catLabel[c] ?? c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-2">Estación</label>
              <div className="flex gap-2">
                {STATIONS.map((st) => (
                  <button key={st} type="button" onClick={() => setStationValue(st)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                      stationValue === st ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                    }`}>
                    {STATION_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>
            {stationResult && (
              <p className="text-sm text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">{stationResult}</p>
            )}
            <Button className="w-full" disabled={!stationCategory || applyingStation} onClick={applyStationByCategory}>
              {applyingStation ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={(v) => { if (!v) setShowImport(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar productos</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ImportProductsModal
              onSuccess={() => { setShowImport(false); load(); }}
              onCancel={() => setShowImport(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
