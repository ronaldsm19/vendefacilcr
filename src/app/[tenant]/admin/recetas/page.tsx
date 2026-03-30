"use client";

import { useEffect, useState } from "react";
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
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  FlaskConical,
  ChevronRight,
  ChefHat,
  History,
} from "lucide-react";
import { IRawMaterial } from "@/models/RawMaterial";
import { IRecipe, IRecipeIngredient } from "@/models/Recipe";
import { IProduction } from "@/models/Production";
import MaterialCombobox from "@/components/admin/MaterialCombobox";

type RecipeRow    = IRecipe & { _id: string };
type ProductOption = { _id: string; name: string };
type ProductionRow = IProduction & { _id: string };

type ValidateResult = {
  canMake: number;
  missing: { name: string; needed: number; have: number; unit: string }[];
};

type IngredientRow = { rawMaterialId: string; quantity: string };

const emptyForm = {
  name:         "",
  description:  "",
  yield:        "1",
  sellingPrice: "",
};

function computeCost(recipe: RecipeRow, materials: IRawMaterial[]): number | null {
  let total = 0;
  for (const ing of recipe.ingredients) {
    const mat = materials.find((m) => String(m._id) === String(ing.rawMaterialId));
    if (!mat?.costPerUnit) return null;
    // Si tiene unitsPerPurchase: costo por unidad base = costPerUnit / unitsPerPurchase
    // Ej: vainilla ₡890/250ml → ₡3.56/ml × 7.5ml = ₡26.70
    const costPerBaseUnit = mat.unitsPerPurchase && mat.unitsPerPurchase > 0
      ? mat.costPerUnit / mat.unitsPerPurchase
      : mat.costPerUnit;
    total += ing.quantity * costPerBaseUnit;
  }
  const batchYield = recipe.yield > 0 ? recipe.yield : 1;
  return total / batchYield;
}

export default function AdminRecetasPage() {
  const [recipes, setRecipes]             = useState<RecipeRow[]>([]);
  const [materials, setMaterials]         = useState<IRawMaterial[]>([]);
  const [products, setProducts]           = useState<ProductOption[]>([]);
  const [productions, setProductions]     = useState<ProductionRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [formEditing, setFormEditing]     = useState<RecipeRow | null>(null);
  const [form, setForm]                   = useState(emptyForm);
  const [rows, setRows]                   = useState<IngredientRow[]>([{ rawMaterialId: "", quantity: "" }]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selected, setSelected]           = useState<RecipeRow | null>(null);
  const [producing, setProducing]         = useState<RecipeRow | null>(null);
  const [batches, setBatches]             = useState("1");
  const [productionNotes, setProductionNotes] = useState("");
  const [validating, setValidating]       = useState(false);
  const [validation, setValidation]       = useState<ValidateResult | null>(null);

  async function load() {
    const [rr, rm, rp, rprod] = await Promise.all([
      fetch("/api/admin/recipes").then((r) => r.json()),
      fetch("/api/admin/materials").then((r) => r.json()),
      fetch("/api/admin/products").then((r) => r.json()),
      fetch("/api/admin/productions").then((r) => r.json()),
    ]);
    setRecipes(rr.recipes ?? []);
    setMaterials(rm.materials ?? []);
    setProducts(rp.products ?? []);
    setProductions(rprod.productions ?? []);
    setLoading(false);
  }

  async function handleProduce() {
    const n = parseInt(batches);
    if (!producing || isNaN(n) || n < 1) return;
    setSaving(true);
    const res = await fetch("/api/admin/productions", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ recipeId: producing._id, batches: n, notes: productionNotes || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      alert(data.error ?? "Error al registrar producción");
      return;
    }
    await load();
    setProducing(null);
    setBatches("1");
    setProductionNotes("");
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setFormEditing(null);
    setForm(emptyForm);
    setRows([{ rawMaterialId: "", quantity: "" }]);
    setShowForm(true);
  }

  function openEdit(recipe: RecipeRow) {
    setFormEditing(recipe);
    setForm({
      name:         recipe.name,
      description:  recipe.description ?? "",
      yield:        String(recipe.yield),
      sellingPrice: recipe.sellingPrice > 0 ? String(recipe.sellingPrice) : "",
    });
    setRows(
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((ing: IRecipeIngredient) => ({
            rawMaterialId: String(ing.rawMaterialId),
            quantity:      String(ing.quantity),
          }))
        : [{ rawMaterialId: "", quantity: "" }]
    );
    setShowForm(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const validRows = rows.filter((r) => r.rawMaterialId && r.quantity);
    const payload = {
      name:         form.name,
      description:  form.description || undefined,
      yield:        parseFloat(form.yield) || 1,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      ingredients:  validRows.map((r) => ({
        rawMaterialId: r.rawMaterialId,
        quantity:      parseFloat(r.quantity),
      })),
    };

    if (formEditing) {
      await fetch(`/api/admin/recipes/${formEditing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/admin/recipes", {
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
    await fetch(`/api/admin/recipes/${id}`, { method: "DELETE" });
    await load();
    setConfirmDelete(null);
  }

  async function handleValidate(recipe: RecipeRow) {
    setSelected(recipe);
    setValidation(null);
    setValidating(true);
    const r = await fetch(`/api/admin/recipes/${recipe._id}/validate`, { method: "POST" });
    const d = await r.json();
    setValidation(d);
    setValidating(false);
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Recetas</h1>
          <p className="text-brand-dark/50 text-sm mt-1">{recipes.length} recetas registradas</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva receta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatsCard
          label="Total recetas"
          value={recipes.length}
          icon={BookOpen}
          color="pink"
          sub="Recetas de producción"
        />
        <StatsCard
          label="Materiales disponibles"
          value={materials.length}
          icon={FlaskConical}
          color="green"
          sub="En inventario"
        />
        <StatsCard
          label="Con precio de venta"
          value={recipes.filter((r) => r.sellingPrice > 0).length}
          icon={ChevronRight}
          color="yellow"
          sub="Con precio registrado"
        />
      </div>

      {/* Recipe cards */}
      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-12 text-center">
          <BookOpen className="w-12 h-12 text-brand-dark/20 mx-auto mb-3" />
          <p className="text-brand-dark/40 text-sm">No hay recetas. Creá la primera.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => {
            const costPerUnit = computeCost(recipe, materials);
            const profit = costPerUnit !== null && recipe.sellingPrice > 0
              ? recipe.sellingPrice - costPerUnit
              : null;

            return (
              <div
                key={recipe._id}
                className="bg-white rounded-2xl card-shadow p-5 flex flex-col gap-3 border border-brand-muted"
              >
                {/* Name */}
                <div>
                  <h3 className="font-brand text-lg font-bold gradient-text leading-tight">
                    {recipe.name}
                  </h3>
                  {recipe.description && (
                    <p className="text-xs text-brand-dark/50 mt-0.5 line-clamp-2">{recipe.description}</p>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-brand-muted/40 rounded-xl p-2.5">
                    <p className="text-brand-dark/50">Rendimiento</p>
                    <p className="font-bold text-brand-dark mt-0.5">
                      {recipe.yield} unidad{recipe.yield !== 1 ? "es" : ""}
                    </p>
                  </div>
                  <div className="bg-brand-muted/40 rounded-xl p-2.5">
                    <p className="text-brand-dark/50">Ingredientes</p>
                    <p className="font-bold text-brand-dark mt-0.5">{recipe.ingredients.length}</p>
                  </div>
                  {recipe.sellingPrice > 0 && (
                    <div className="bg-brand-muted/40 rounded-xl p-2.5">
                      <p className="text-brand-dark/50">Precio venta</p>
                      <p className="font-bold text-emerald-600 mt-0.5">
                        ₡{recipe.sellingPrice.toLocaleString("es-CR")}
                      </p>
                    </div>
                  )}
                  {costPerUnit !== null && (
                    <div className="bg-brand-muted/40 rounded-xl p-2.5">
                      <p className="text-brand-dark/50">Costo/u</p>
                      <p className="font-bold text-brand-dark mt-0.5">
                        ₡{costPerUnit.toLocaleString("es-CR", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                  {profit !== null && (
                    <div className={`rounded-xl p-2.5 col-span-2 ${profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                      <p className={`text-xs ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        Ganancia por unidad:{" "}
                        <span className="font-bold">
                          ₡{profit.toLocaleString("es-CR", { maximumFractionDigits: 0 })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-brand-muted">
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => { setProducing(recipe); setBatches("1"); setProductionNotes(""); }}
                  >
                    <ChefHat className="w-3.5 h-3.5 mr-1" />
                    Producir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => handleValidate(recipe)}
                  >
                    Validar stock
                  </Button>
                  <button
                    onClick={() => openEdit(recipe)}
                    className="p-1.5 rounded-lg text-brand-dark/40 hover:text-brand-pink hover:bg-brand-pink/5 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(recipe._id)}
                    className="p-1.5 rounded-lg text-brand-dark/40 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Validate Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setValidation(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            {/* Ingredients table */}
            {selected && selected.ingredients.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wide mb-2">
                  Ingredientes — {selected.yield} unidad{selected.yield !== 1 ? "es" : ""} por tanda
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-brand-dark/40 border-b border-brand-muted">
                      <th className="text-left py-1.5">Ingrediente</th>
                      <th className="text-right py-1.5">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.ingredients.map((ing, i) => (
                      <tr key={i} className="border-b border-brand-muted/40">
                        <td className="py-2 text-brand-dark/80">{ing.rawMaterialName}</td>
                        <td className="py-2 text-right text-brand-dark/60 text-xs">
                          {ing.quantity} {ing.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Validation result */}
            {validating && (
              <p className="text-sm text-brand-dark/40">Verificando inventario...</p>
            )}

            {validation && !validating && (
              <div className="rounded-xl border border-brand-muted p-4 space-y-3">
                <p className={`font-semibold text-sm ${validation.canMake > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {validation.canMake > 0
                    ? `Podés hacer ${validation.canMake} tanda${validation.canMake > 1 ? "s" : ""} completa${validation.canMake > 1 ? "s" : ""}`
                    : "No hay stock suficiente para esta receta"}
                </p>

                {validation.missing.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-brand-dark/50">Ingredientes faltantes:</p>
                    {validation.missing.map((m, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="text-brand-dark/70">
                          <span className="font-medium">{m.name}</span>: necesitás {m.needed} {m.unit}, tenés {m.have}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {validation.missing.length === 0 && validation.canMake > 0 && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Todos los ingredientes disponibles
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setValidation(null); handleValidate(selected!); }}
              disabled={validating}
            >
              Volver a validar
            </Button>
            <Button onClick={() => { setSelected(null); setValidation(null); }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Recipe Modal */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent
          className="sm:max-w-2xl flex flex-col overflow-hidden h-[90vh]"
          onInteractOutside={(e) => {
            // Prevent Radix from closing the dialog when the user clicks inside
            // the MaterialCombobox portal dropdown (rendered in document.body)
            const target = (e as CustomEvent).detail?.originalEvent?.target as Node | null;
            const portal = document.getElementById("material-combobox-portal");
            if (portal && target && portal.contains(target)) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{formEditing ? "Editar receta" : "Nueva receta"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
          <form onSubmit={handleFormSubmit} className="px-6 pb-2 space-y-4">
            {/* Nombre — lista de productos */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">
                Producto <span className="text-red-400">*</span>
              </label>
              {products.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  No hay productos registrados. Agregá productos primero.
                </p>
              ) : (
                <select
                  required
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white"
                >
                  <option value="">Seleccionar producto...</option>
                  {/* Si editando y el nombre no está en la lista, mostrarlo igual */}
                  {formEditing && form.name && !products.find(p => p.name === form.name) && (
                    <option value={form.name}>{form.name}</option>
                  )}
                  {products.map((p) => (
                    <option key={p._id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Descripción</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Notas sobre la receta..."
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Rendimiento */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">
                  Rendimiento (unidades)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={form.yield}
                  onChange={(e) => setForm(f => ({ ...f, yield: e.target.value }))}
                  placeholder="1"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>

              {/* Precio de venta */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Precio de venta (₡/u)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.sellingPrice}
                  onChange={(e) => setForm(f => ({ ...f, sellingPrice: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-brand-dark">Ingredientes</label>
                <button
                  type="button"
                  onClick={() => setRows(r => [...r, { rawMaterialId: "", quantity: "" }])}
                  className="text-xs text-brand-pink hover:text-brand-orange flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>

              {materials.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-2">
                  No hay materiales en inventario. Agregá materiales primero.
                </p>
              )}

              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <MaterialCombobox
                      materials={materials}
                      value={row.rawMaterialId}
                      onChange={(id) => setRows(r => r.map((x, i) => i === idx ? { ...x, rawMaterialId: id } : x))}
                    />
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={row.quantity}
                      onChange={(e) => setRows(r => r.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                      placeholder="Cant."
                      className="w-20 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                    />
                    <button
                      type="button"
                      onClick={() => setRows(r => r.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg text-brand-dark/30 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="text-xs text-brand-dark/40 text-center py-2">
                    Sin ingredientes — la receta se guardará vacía.
                  </p>
                )}
              </div>
            </div>
          </form>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                handleFormSubmit({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              {saving ? "Guardando..." : formEditing ? "Guardar cambios" : "Crear receta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production History */}
      {productions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand-dark/50" />
            <h2 className="font-brand text-lg font-bold text-brand-dark">Historial de producción</h2>
          </div>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Fecha</th>
                    <th className="text-left px-4 py-3">Receta</th>
                    <th className="text-left px-4 py-3">Tandas</th>
                    <th className="text-left px-4 py-3">Unidades</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {productions.map((p) => (
                    <tr key={p._id} className="border-b border-brand-muted/50 hover:bg-brand-muted/20 transition-colors">
                      <td className="px-4 py-3 text-brand-dark/60 text-xs whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString("es-CR", {
                          day:   "2-digit",
                          month: "short",
                          year:  "numeric",
                          hour:  "2-digit",
                          minute:"2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-brand-dark">{p.recipeName}</td>
                      <td className="px-4 py-3 text-brand-dark/70">{p.batches}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600">
                          {p.unitsProduced} u
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-brand-dark/40 text-xs">
                        {p.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Produce Modal */}
      <Dialog open={!!producing} onOpenChange={(open) => { if (!open) setProducing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar producción</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <p className="text-sm text-brand-dark/70">
              Receta: <span className="font-semibold text-brand-dark">{producing?.name}</span>
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">
                  Tandas producidas
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={batches}
                  onChange={(e) => setBatches(e.target.value)}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-brand-dark/50 mb-1">Unidades a producir</p>
                <p className="text-2xl font-bold gradient-text">
                  {(parseInt(batches) || 0) * (producing?.yield ?? 1)}
                </p>
              </div>
            </div>

            {/* Ingredients preview */}
            {producing && producing.ingredients.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wide mb-2">
                  Ingredientes a descontar
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {producing.ingredients.map((ing, i) => {
                    const total = ing.quantity * (parseInt(batches) || 1);
                    const mat = materials.find(m => String(m._id) === String(ing.rawMaterialId));
                    const hasStock = (mat?.stock ?? 0) >= total;
                    return (
                      <div key={i} className={`flex items-center justify-between text-sm px-3 py-1.5 rounded-lg ${hasStock ? "bg-brand-muted/30" : "bg-red-50"}`}>
                        <span className={hasStock ? "text-brand-dark/70" : "text-red-600 font-medium"}>
                          {ing.rawMaterialName}
                        </span>
                        <span className={`text-xs font-semibold ${hasStock ? "text-brand-dark/50" : "text-red-500"}`}>
                          -{total} {ing.unit}
                          {!hasStock && <span className="ml-1">(sin stock)</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Notas (opcional)</label>
              <input
                type="text"
                value={productionNotes}
                onChange={(e) => setProductionNotes(e.target.value)}
                placeholder="Ej: Producción para pedido del sábado"
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProducing(null)}>Cancelar</Button>
            <Button onClick={handleProduce} disabled={saving || !batches || parseInt(batches) < 1}>
              {saving ? "Registrando..." : "Confirmar producción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar receta</DialogTitle>
          </DialogHeader>
          <p className="px-6 py-2 text-sm text-brand-dark/70">
            ¿Seguro que querés eliminar esta receta? Esta acción no se puede deshacer.
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
