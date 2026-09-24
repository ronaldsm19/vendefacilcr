"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { IProduct, ProductExtra } from "@/models/Product";
import { X, Plus, Upload, ImageIcon, Loader2, Images } from "lucide-react";
import CategoryCombobox from "@/components/admin/CategoryCombobox";
import { STATIONS, effectiveStation } from "@/lib/station";

const MAX_EXTRA_IMAGES = 4;

interface ProductFormProps {
  initial?: Partial<IProduct>;
  onSave: (data: Partial<IProduct>) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  showStation?: boolean;
}

export default function ProductForm({ initial, onSave, onCancel, saving, showStation }: ProductFormProps) {
  const [form, setForm] = useState({
    name:         initial?.name         ?? "",
    description:  initial?.description  ?? "",
    price:        initial?.price?.toString() ?? "",
    cost:         initial?.cost?.toString()  ?? "",
    stock:        initial?.stock?.toString() ?? "0",
    image:        initial?.image        ?? "",
    category:     initial?.category     ?? "",
    menuSection:  initial?.menuSection  ?? "panaderia",
    station:      effectiveStation(initial ?? {}),
    available:    initial?.available    ?? true,
    featured:     initial?.featured     ?? false,
    delivery:     initial?.delivery     ?? false,
    deliveryNote: initial?.deliveryNote ?? "",
  });
  const [extras, setExtras]               = useState<{ name: string; price: string }[]>(
    initial?.extras?.map(e => ({ name: e.name, price: String(e.price) })) ?? []
  );
  const [extrasError, setExtrasError]     = useState("");
  const [offers, setOffers]               = useState<{ qty: string; price: string }[]>(
    initial?.offers?.map(o => ({ qty: String(o.qty), price: String(o.price) })) ?? []
  );
  const [extraImages, setExtraImages]     = useState<string[]>(initial?.images ?? []);
  const [uploading, setUploading]         = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [uploadError, setUploadError]     = useState("");
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);

  function updateExtra(idx: number, field: "name" | "price", value: string) {
    setExtras((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
    setExtrasError("");
  }

  /** Filas vacías se ignoran; nombre sin precio, precio negativo o nombres repetidos no se guardan. */
  function parseExtras(): ProductExtra[] | null {
    const out: ProductExtra[] = [];
    const seen = new Set<string>();
    for (const row of extras) {
      const name = row.name.trim();
      const priceText = row.price.trim();
      if (!name && !priceText) continue;
      if (!name) { setExtrasError("Cada extra necesita un nombre."); return null; }
      const price = Number(priceText);
      if (priceText === "" || !Number.isFinite(price) || price < 0) {
        setExtrasError(`Poné el precio de "${name}" (0 si no tiene costo).`);
        return null;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) { setExtrasError(`El extra "${name}" está repetido.`); return null; }
      seen.add(key);
      out.push({ name, price });
    }
    return out;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      // Enviar URL anterior para que el servidor la elimine de Supabase
      if (form.image) formData.append("oldImageUrl", form.image);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error ?? "Error al subir la imagen");
        return;
      }

      setForm((prev) => ({ ...prev, image: data.url }));
    } catch {
      setUploadError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExtraFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (extraImages.length >= MAX_EXTRA_IMAGES) return;

    setUploadingExtra(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setExtraImages((prev) => [...prev, data.url]);
      } else {
        setUploadError(data.error ?? "Error al subir imagen adicional");
      }
    } catch {
      setUploadError("Error de conexión al subir imagen adicional");
    } finally {
      setUploadingExtra(false);
      if (extraFileInputRef.current) extraFileInputRef.current.value = "";
    }
  }

  async function removeExtraImage(url: string) {
    setExtraImages((prev) => prev.filter((u) => u !== url));
    // Eliminar de Supabase en background
    fetch("/api/admin/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(console.error);
  }

  function clearImage() {
    setForm((prev) => ({ ...prev, image: "" }));
    setUploadError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category.trim()) {
      setUploadError("Debes seleccionar o crear una categoría");
      return;
    }
    const parsedExtras = parseExtras();
    if (!parsedExtras) return;
    await onSave({
      ...form,
      price: Number(form.price),
      cost:  form.cost !== "" ? Number(form.cost) : 0,
      stock: Number(form.stock),
      extras: parsedExtras,
      images: extraImages,
      delivery: form.delivery,
      deliveryNote: form.deliveryNote,
      menuSection: form.menuSection as "panaderia" | "bebidas" | "",
      offers: offers
        .filter(o => o.qty && o.price)
        .map(o => ({ qty: Number(o.qty), price: Number(o.price) }))
        .sort((a, b) => a.qty - b.qty),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Dos columnas en escritorio, una en el teléfono */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-8 lg:items-start">
      {/* Columna izquierda: datos del producto */}
      <div className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Nombre *</label>
        <input
          type="text" required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Descripción</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
        />
      </div>

      {/* Precios */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Precio de venta (₡) *</label>
          <input
            type="number" required min={0}
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Precio de costo (₡)</label>
          <input
            type="number" min={0}
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            placeholder="0"
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
      </div>

      {/* Categoría */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Categoría *</label>
        <CategoryCombobox
          value={form.category}
          onChange={(val) => setForm({ ...form, category: val })}
        />
      </div>

      {/* Sección del menú */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-2">Sección del menú público</label>
        <div className="flex gap-2">
          {(["panaderia", "bebidas"] as const).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setForm({ ...form, menuSection: sec })}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${
                form.menuSection === sec
                  ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                  : "border-brand-muted text-brand-dark/50 hover:border-brand-pink/40"
              }`}
            >
              {sec === "panaderia" ? "🥐 Panadería" : "☕ Bebidas"}
            </button>
          ))}
        </div>
      </div>

      {/* Estación de preparación (comandas) */}
      {showStation && (
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-2">Estación de preparación</label>
          <div className="flex gap-2">
            {STATIONS.map((st) => (
              <button key={st} type="button" onClick={() => setForm({ ...form, station: st })}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  form.station === st ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50 hover:border-brand-pink/40"
                }`}>
                {st === "cocina" ? "🍳 Cocina" : st === "bebidas" ? "🥤 Bebidas" : "Ninguna"}
              </button>
            ))}
          </div>
          <p className="text-xs text-brand-dark/50 mt-1">Define a qué impresora va el ítem cuando se toma una comanda. &quot;Ninguna&quot; no se imprime.</p>
        </div>
      )}

      {/* Stock */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Stock disponible</label>
        <input
          type="number" min={0} step={1}
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
        />
      </div>

      {/* Disponible */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox" id="available"
          checked={form.available}
          onChange={(e) => setForm({ ...form, available: e.target.checked })}
          className="rounded"
        />
        <label htmlFor="available" className="text-sm text-brand-dark">Disponible para la venta</label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox" id="featured"
          checked={form.featured}
          onChange={(e) => setForm({ ...form, featured: e.target.checked })}
          className="rounded"
        />
        <label htmlFor="featured" className="text-sm text-brand-dark">
          🔥 Destacar en "Más Vendidos"
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox" id="delivery"
          checked={form.delivery}
          onChange={(e) => setForm({ ...form, delivery: e.target.checked })}
          className="rounded"
        />
        <label htmlFor="delivery" className="text-sm text-brand-dark">
          🚗 Envío disponible
        </label>
      </div>

      {form.delivery && (
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">
            Nota de envío / horarios
          </label>
          <textarea
            rows={3}
            value={form.deliveryNote}
            onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })}
            placeholder="Ej: Disponibles sábados y domingos. Envíos con costo adicional según distancia..."
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
          />
        </div>
      )}
      </div>

      {/* Columna derecha (en escritorio): imágenes, extras y ofertas */}
      <div className="space-y-4">
      {/* ── Imagen principal ── */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-2">
          Imagen principal <span className="text-brand-dark/40 font-normal">(opcional)</span>
        </label>

        {form.image ? (
          <div className="relative rounded-xl overflow-hidden border border-brand-muted bg-brand-muted/30">
            <div className="relative w-full h-40">
              <Image
                src={form.image}
                alt="Vista previa"
                fill
                className="object-cover"
                sizes="400px"
              />
            </div>
            {/* Siempre visibles (en el teléfono no hay "hover") */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-2 bg-gradient-to-t from-black/50 to-transparent">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-brand-dark hover:bg-brand-muted transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Cambiar
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-auto px-3 py-1.5 rounded-lg gap-1.5"
                  onClick={clearImage}
                >
                  <X className="w-3.5 h-3.5" /> Quitar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-brand-muted hover:border-brand-pink/50 rounded-xl py-8 flex flex-col items-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-brand-muted/20 hover:bg-brand-pink/5"
          >
            {uploading ? (
              <>
                <Loader2 className="w-7 h-7 text-brand-pink animate-spin" />
                <span className="text-sm text-brand-dark/50">Subiendo imagen...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-7 h-7 text-brand-dark/30" />
                <span className="text-sm font-medium text-brand-dark/60">
                  Haz click para seleccionar una imagen
                </span>
                <span className="text-xs text-brand-dark/40">
                  JPG, PNG, WEBP · Máx. 5 MB
                </span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploadError && (
          <p className="mt-1.5 text-xs text-red-500">{uploadError}</p>
        )}
      </div>

      {/* ── Imágenes adicionales (carrusel) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-brand-dark flex items-center gap-1.5">
            <Images className="w-4 h-4 text-brand-pink" />
            Imágenes adicionales
            <span className="text-brand-dark/40 font-normal">(opcional · carrusel)</span>
          </label>
          <span className="text-xs text-brand-dark/40">{extraImages.length}/{MAX_EXTRA_IMAGES}</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {/* Imágenes subidas */}
          {extraImages.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-brand-muted group">
              <Image src={url} alt={`Extra ${i + 1}`} fill className="object-cover" sizes="100px" />
              <Button
                type="button"
                size="icon-xs"
                variant="destructive"
                className="absolute top-1 right-1"
                title="Eliminar imagen"
                aria-label={`Eliminar imagen ${i + 1}`}
                onClick={() => removeExtraImage(url)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}

          {/* Botón agregar */}
          {extraImages.length < MAX_EXTRA_IMAGES && (
            <button
              type="button"
              onClick={() => extraFileInputRef.current?.click()}
              disabled={uploadingExtra}
              className="aspect-square rounded-xl border-2 border-dashed border-brand-muted hover:border-brand-pink/50 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 bg-brand-muted/20 hover:bg-brand-pink/5"
            >
              {uploadingExtra ? (
                <Loader2 className="w-5 h-5 text-brand-pink animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5 text-brand-dark/40" />
                  <span className="text-[10px] text-brand-dark/40">Agregar</span>
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={extraFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleExtraFileChange}
        />
        <p className="text-xs text-brand-dark/40 mt-1.5">
          Se mostrarán en carrusel · cambian automáticamente cada 1 minuto
        </p>
      </div>

      {/* ── Extras con precio ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-brand-dark">
            Extras
            <span className="text-brand-dark/40 font-normal ml-1">(opcional)</span>
          </label>
          <button
            type="button"
            onClick={() => setExtras(prev => [...prev, { name: "", price: "" }])}
            className="text-xs text-brand-pink hover:text-brand-orange font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar extra
          </button>
        </div>
        <p className="text-xs text-brand-dark/40 mb-2">
          Ej: Queso extra · ₡500. Se suma al precio de cada unidad; 0 si no tiene costo.
        </p>
        {extras.length > 0 && (
          <div className="space-y-2">
            {extras.map((extra, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Nombre del extra"
                  aria-label={`Nombre del extra ${idx + 1}`}
                  value={extra.name}
                  onChange={e => updateExtra(idx, "name", e.target.value)}
                  className="flex-1 min-w-0 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
                <div className="relative w-28 shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-dark/50">₡</span>
                  <input
                    type="number" min={0} step="any" inputMode="decimal"
                    placeholder="Precio"
                    aria-label={`Precio del extra ${idx + 1}`}
                    value={extra.price}
                    onChange={e => updateExtra(idx, "price", e.target.value)}
                    className="w-full border border-brand-muted rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                  />
                </div>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="destructive"
                  className="shrink-0"
                  title="Eliminar extra"
                  aria-label="Eliminar extra"
                  onClick={() => { setExtras(prev => prev.filter((_, i) => i !== idx)); setExtrasError(""); }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {extrasError && <p className="mt-1.5 text-xs text-red-500">{extrasError}</p>}
      </div>

      {/* ── Ofertas por cantidad ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-brand-dark">
            🏷️ Ofertas por cantidad
            <span className="text-brand-dark/40 font-normal ml-1">(opcional)</span>
          </label>
          <button
            type="button"
            onClick={() => setOffers(prev => [...prev, { qty: "", price: "" }])}
            className="text-xs text-brand-pink hover:text-brand-orange font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar oferta
          </button>
        </div>
        <p className="text-xs text-brand-dark/40 mb-2">
          Ej: 4 unidades por ₡5400 · El precio unitario regular se usa como referencia
        </p>
        {offers.length > 0 && (
          <div className="space-y-2">
            {offers.map((offer, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <div className="w-24">
                    <input
                      type="number" min={1} placeholder="Cant."
                      value={offer.qty}
                      onChange={e => setOffers(prev => prev.map((o, i) => i === idx ? { ...o, qty: e.target.value } : o))}
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                    />
                  </div>
                  <span className="text-brand-dark/40 text-sm">×</span>
                  <div className="flex-1">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-dark/50">₡</span>
                      <input
                        type="number" min={0} placeholder="Precio oferta"
                        value={offer.price}
                        onChange={e => setOffers(prev => prev.map((o, i) => i === idx ? { ...o, price: e.target.value } : o))}
                        className="w-full border border-brand-muted rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="destructive"
                  className="shrink-0"
                  title="Eliminar oferta"
                  aria-label="Eliminar oferta"
                  onClick={() => setOffers(prev => prev.filter((_, i) => i !== idx))}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || uploading || uploadingExtra} className="flex-1">
          {saving ? "Guardando..." : initial?._id ? "Actualizar producto" : "Crear producto"}
        </Button>
        <Button type="button" variant="cancel" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
