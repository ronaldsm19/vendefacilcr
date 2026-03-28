"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Upload, X, Loader2, Check, Plus, Trash2, Phone,
} from "lucide-react";
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

interface SocialData {
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
}

const ABOUT_DEFAULTS: AboutData = {
  title: "",
  paragraph1: "",
  paragraph2: "",
  images: ["", "", "", ""],
};

const SOCIAL_DEFAULTS: SocialData = {
  whatsapp: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  youtube: "",
};

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width="16" height="16" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className={className}>
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

function IconTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.22 8.22 0 004.8 1.54V6.76a4.85 4.85 0 01-1.03-.07z" />
    </svg>
  );
}

function IconYouTube({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className={className}>
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  );
}

export default function ConfiguracionPage() {
  // ── About state ──────────────────────────────────────────────────
  const [about, setAbout] = useState<AboutData>(ABOUT_DEFAULTS);
  const [loadingAbout, setLoadingAbout] = useState(true);
  const [savingAbout, setSavingAbout] = useState(false);
  const [savedAbout, setSavedAbout] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // ── Social state ─────────────────────────────────────────────────
  const [social, setSocial] = useState<SocialData>(SOCIAL_DEFAULTS);
  const [loadingSocial, setLoadingSocial] = useState(true);
  const [savingSocial, setSavingSocial] = useState(false);
  const [savedSocial, setSavedSocial] = useState(false);

  // ── Categories state ─────────────────────────────────────────────
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
    // About
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.about) {
          const imgs = [...(data.about.images ?? [])];
          while (imgs.length < 4) imgs.push("");
          setAbout({ ...ABOUT_DEFAULTS, ...data.about, images: imgs });
        }
      })
      .finally(() => setLoadingAbout(false));

    // Social
    fetch("/api/admin/social")
      .then((r) => r.json())
      .then((data) => setSocial({ ...SOCIAL_DEFAULTS, ...data }))
      .finally(() => setLoadingSocial(false));

    // Categories
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .finally(() => setCatsLoading(false));
  }, []);

  // ── Handlers: about ──────────────────────────────────────────────
  async function handleSaveAbout(e: React.FormEvent) {
    e.preventDefault();
    setSavingAbout(true);
    try {
      const images = about.images.filter(Boolean);
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: { ...about, images } }),
      });
      setSavedAbout(true);
      setTimeout(() => setSavedAbout(false), 3000);
    } finally {
      setSavingAbout(false);
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

  // ── Handlers: social ─────────────────────────────────────────────
  async function handleSaveSocial(e: React.FormEvent) {
    e.preventDefault();
    setSavingSocial(true);
    try {
      await fetch("/api/admin/social", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(social),
      });
      setSavedSocial(true);
      setTimeout(() => setSavedSocial(false), 3000);
    } finally {
      setSavingSocial(false);
    }
  }

  // ── Handlers: categories ─────────────────────────────────────────
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

  if (loadingAbout || loadingSocial) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <h1 className="font-brand text-2xl font-bold text-brand-dark">Configuración del sitio</h1>

      {/* ── Redes Sociales ──────────────────────────────────────────── */}
      <form onSubmit={handleSaveSocial}>
        <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-brand-dark text-lg">Redes sociales y contacto</h2>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              Estos datos aparecen en el pie de página de tu tienda.
            </p>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Número de WhatsApp
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dark/30" strokeWidth={2} />
              <input
                type="tel"
                value={social.whatsapp}
                onChange={(e) => setSocial({ ...social, whatsapp: e.target.value })}
                placeholder="50688888888"
                className="w-full border border-brand-muted rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
            <p className="text-xs text-brand-dark/40 mt-1">
              Incluí el código de país sin el +. Ej: 50688887777
            </p>
          </div>

          {/* Instagram */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Instagram</label>
            <div className="relative">
              <IconInstagram className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30" />
              <input
                type="url"
                value={social.instagram}
                onChange={(e) => setSocial({ ...social, instagram: e.target.value })}
                placeholder="https://www.instagram.com/tuperfil"
                className="w-full border border-brand-muted rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
          </div>

          {/* Facebook */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Facebook</label>
            <div className="relative">
              <IconFacebook className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30" />
              <input
                type="url"
                value={social.facebook}
                onChange={(e) => setSocial({ ...social, facebook: e.target.value })}
                placeholder="https://www.facebook.com/tupagina"
                className="w-full border border-brand-muted rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
          </div>

          {/* TikTok */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">TikTok</label>
            <div className="relative">
              <IconTikTok className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30" />
              <input
                type="url"
                value={social.tiktok}
                onChange={(e) => setSocial({ ...social, tiktok: e.target.value })}
                placeholder="https://www.tiktok.com/@tuperfil"
                className="w-full border border-brand-muted rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
          </div>

          {/* YouTube */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">YouTube</label>
            <div className="relative">
              <IconYouTube className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark/30" />
              <input
                type="url"
                value={social.youtube}
                onChange={(e) => setSocial({ ...social, youtube: e.target.value })}
                placeholder="https://www.youtube.com/@tucanal"
                className="w-full border border-brand-muted rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={savingSocial} className="flex-1">
              {savingSocial ? "Guardando..." : "Guardar redes sociales"}
            </Button>
            {savedSocial && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <Check className="w-4 h-4" /> Guardado
              </span>
            )}
          </div>
        </section>
      </form>

      {/* ── Sección Nosotros ────────────────────────────────────────── */}
      <form onSubmit={handleSaveAbout}>
        <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
          <h2 className="font-semibold text-brand-dark text-lg">Sección &quot;Nosotros&quot;</h2>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Título</label>
            <input
              type="text"
              value={about.title}
              onChange={(e) => setAbout({ ...about, title: e.target.value })}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Primer párrafo</label>
            <textarea
              rows={3}
              value={about.paragraph1}
              onChange={(e) => setAbout({ ...about, paragraph1: e.target.value })}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Segundo párrafo</label>
            <textarea
              rows={3}
              value={about.paragraph2}
              onChange={(e) => setAbout({ ...about, paragraph2: e.target.value })}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-2">
              Imágenes (4 fotos para el collage)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {about.images.map((url, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-xl overflow-hidden border border-brand-muted bg-brand-muted/20 group"
                >
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
              Si no subís imágenes, se usan las predeterminadas del sistema.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={savingAbout} className="flex-1">
              {savingAbout ? "Guardando..." : "Guardar sección Nosotros"}
            </Button>
            {savedAbout && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <Check className="w-4 h-4" /> Guardado
              </span>
            )}
          </div>
        </section>
      </form>

      {/* ── Categorías de productos ─────────────────────────────────── */}
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
            {addingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </form>
      </section>
    </div>
  );
}
