"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Upload, X, Loader2, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Category {
  _id: string;
  label: string;
}

interface AboutData {
  title: string;
  paragraph1: string;
  paragraph2: string;
  images: string[];
}

const DEFAULTS: AboutData = {
  title: "Hechos con amor en Turrialba",
  paragraph1: "Dulce Pecado nació de un momento espontáneo, con muchas ganas de crear algo especial.",
  paragraph2: "Hoy, cada postre y cada apretado gourmet está hecho con amor, buscando convertir lo simple en algo delicioso 🤍✨",
  images: ["", "", "", ""],
};

export default function ConfiguracionPage() {
  const [about, setAbout] = useState<AboutData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.about) {
          const imgs = [...(data.about.images ?? [])];
          while (imgs.length < 4) imgs.push("");
          setAbout({ ...DEFAULTS, ...data.about, images: imgs });
        }
      })
      .finally(() => setLoading(false));

    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .finally(() => setCatsLoading(false));
  }, []);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const label = newCatLabel.trim();
    if (!label) return;
    setAddingCat(true);
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
        setNewCatLabel("");
      }
    } finally {
      setAddingCat(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    setDeletingCatId(id);
    try {
      await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } finally {
      setDeletingCatId(null);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload?folder=about", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAbout((prev) => {
          const imgs = [...prev.images];
          imgs[idx] = data.url;
          return { ...prev, images: imgs };
        });
      }
    } finally {
      setUploadingIdx(null);
      if (fileRefs[idx].current) fileRefs[idx].current!.value = "";
    }
  }

  function removeImage(idx: number) {
    const url = about.images[idx];
    setAbout((prev) => {
      const imgs = [...prev.images];
      imgs[idx] = "";
      return { ...prev, images: imgs };
    });
    if (url) {
      fetch("/api/admin/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }).catch(console.error);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const images = about.images.filter(Boolean);
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: { ...about, images } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="font-brand text-2xl font-bold text-brand-dark mb-6">Configuración del sitio</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
          <h2 className="font-semibold text-brand-dark text-lg">Sección "Nosotros"</h2>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Título</label>
            <input
              type="text"
              value={about.title}
              onChange={(e) => setAbout({ ...about, title: e.target.value })}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>

          {/* Párrafo 1 */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Primer párrafo</label>
            <textarea
              rows={3}
              value={about.paragraph1}
              onChange={(e) => setAbout({ ...about, paragraph1: e.target.value })}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          {/* Párrafo 2 */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Segundo párrafo</label>
            <textarea
              rows={3}
              value={about.paragraph2}
              onChange={(e) => setAbout({ ...about, paragraph2: e.target.value })}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          {/* Imágenes */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-2">
              Imágenes (4 fotos para el collage)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {about.images.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-brand-muted bg-brand-muted/20 group">
                  {url ? (
                    <>
                      <Image src={url} alt={`Foto ${idx + 1}`} fill className="object-cover" sizes="100px" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => fileRefs[idx].current?.click()}
                          className="p-1.5 bg-white rounded-lg"
                        >
                          <Upload className="w-3.5 h-3.5 text-brand-dark" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="p-1.5 bg-white rounded-lg"
                        >
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRefs[idx].current?.click()}
                      disabled={uploadingIdx === idx}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 hover:bg-brand-pink/5 transition-colors"
                    >
                      {uploadingIdx === idx ? (
                        <Loader2 className="w-5 h-5 animate-spin text-brand-pink" />
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-brand-dark/30" />
                          <span className="text-[10px] text-brand-dark/40">{idx + 1}</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileRefs[idx]}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, idx)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-brand-dark/40 mt-1.5">
              Si no subes imágenes, se usan las predeterminadas del sistema.
            </p>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <Check className="w-4 h-4" /> Guardado
            </span>
          )}
        </div>
      </form>

      {/* ── Categorías de productos ── */}
      <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-brand-dark text-lg">Categorías de productos</h2>
          <p className="text-sm text-brand-dark/50 mt-0.5">
            Las categorías aparecen en el formulario de productos para organizar tu catálogo.
          </p>
        </div>

        {catsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-brand-pink" />
          </div>
        ) : (
          <div className="space-y-2">
            {categories.length === 0 && (
              <p className="text-sm text-brand-dark/40 italic">No hay categorías aún.</p>
            )}
            {categories.map((cat) => (
              <div
                key={cat._id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-brand-muted bg-brand-muted/10"
              >
                <span className="text-sm text-brand-dark">{cat.label}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat._id)}
                  disabled={deletingCatId === cat._id}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/30 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {deletingCatId === cat._id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            placeholder="Nueva categoría..."
            className="flex-1 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
          <Button type="submit" disabled={addingCat || !newCatLabel.trim()} size="sm">
            {addingCat ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
