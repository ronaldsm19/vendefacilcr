"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Upload, X, Loader2, Check, Plus, Trash2, Phone, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Category {
  _id: string;
  label: string;
}

interface HeroData {
  tagline: string;
  subtagline: string;
  badge: string;
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

const HERO_DEFAULTS: HeroData = {
  tagline:    "",
  subtagline: "",
  badge:      "",
};

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

interface ThemeData {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  darkMode: boolean;
  fontFamily: string;
  logoShape: string;
  logoBgColor: string;
  heroImageUrl: string;
}

interface MenuConfigData {
  columns: 1 | 2 | 3;
  showImage: boolean;
  showPrice: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgImageUrl: string;
  bgBlur: number;
  title: string;
  description: string;
  fontFamily: string;
}

const MENU_CONFIG_DEFAULTS: MenuConfigData = {
  columns: 2,
  showImage: true,
  showPrice: true,
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  bgImageUrl: "",
  bgBlur: 0,
  title: "",
  description: "",
  fontFamily: "default",
};

const THEME_DEFAULTS: ThemeData = {
  primaryColor: "#6366F1",
  secondaryColor: "#8B5CF6",
  accentColor: "#F59E0B",
  backgroundColor: "#FFFFFF",
  darkMode: false,
  fontFamily: "default",
  logoShape: "circle",
  logoBgColor: "",
  heroImageUrl: "",
};

const FONT_OPTIONS: { key: string; label: string; css: string }[] = [
  { key: "default",    label: "Inter",             css: "Inter, system-ui, sans-serif" },
  { key: "playfair",   label: "Playfair Display",  css: "var(--font-playfair), Georgia, serif" },
  { key: "montserrat", label: "Montserrat",         css: "var(--font-montserrat), system-ui, sans-serif" },
  { key: "nunito",     label: "Nunito",             css: "var(--font-nunito), system-ui, sans-serif" },
  { key: "lato",       label: "Lato",               css: "var(--font-lato), system-ui, sans-serif" },
];

const SHAPE_OPTIONS: { key: string; label: string; borderClass: string }[] = [
  { key: "circle",  label: "Circular",    borderClass: "rounded-full" },
  { key: "rounded", label: "Redondeado",  borderClass: "rounded-xl" },
  { key: "square",  label: "Cuadrado",    borderClass: "rounded-none" },
  { key: "none",    label: "Sin marco",   borderClass: "rounded-none" },
];

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
  // ── Logo state ───────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // ── Theme state ───────────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeData>(THEME_DEFAULTS);
  const [loadingTheme, setLoadingTheme] = useState(true);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savedTheme, setSavedTheme] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  // ── Hero state ───────────────────────────────────────────────────
  const [hero, setHero] = useState<HeroData>(HERO_DEFAULTS);
  const [savingHero, setSavingHero] = useState(false);
  const [savedHero, setSavedHero] = useState(false);

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

  // ── Menu config state ────────────────────────────────────────────
  const [menuConfig, setMenuConfig] = useState<MenuConfigData>(MENU_CONFIG_DEFAULTS);
  const [savingMenu, setSavingMenu] = useState(false);
  const [savedMenu, setSavedMenu] = useState(false);
  const [uploadingMenuBg, setUploadingMenuBg] = useState(false);
  const menuBgFileRef = useRef<HTMLInputElement>(null);

  // ── Tab state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"marca" | "portada" | "nosotros" | "productos" | "menu" | "caja">("marca");

  // ── Table count state ─────────────────────────────────────────────
  const [tableCount, setTableCount]       = useState(0);
  const [savingTables, setSavingTables]   = useState(false);
  const [savedTables, setSavedTables]     = useState(false);

  // ── Cash users state ─────────────────────────────────────────────
  interface CashUser { _id: string; name: string; }
  const [cashUsers, setCashUsers]         = useState<CashUser[]>([]);
  const [cashUsersLoading, setCashUsersLoading] = useState(true);
  const [newCashUserName, setNewCashUserName]   = useState("");
  const [addingCashUser, setAddingCashUser]     = useState(false);
  const [deletingCashUserId, setDeletingCashUserId] = useState<string | null>(null);
  const [editingCashUserId, setEditingCashUserId]   = useState<string | null>(null);
  const [editingCashUserName, setEditingCashUserName] = useState("");

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
    // Logo
    fetch("/api/admin/profile")
      .then((r) => r.json())
      .then((data) => { if (data?.logoUrl) setLogoUrl(data.logoUrl); });

    // Theme
    fetch("/api/admin/theme")
      .then((r) => r.json())
      .then((data) => setTheme({ ...THEME_DEFAULTS, ...data }))
      .finally(() => setLoadingTheme(false));

    // About + Hero
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.hero) setHero({ ...HERO_DEFAULTS, ...data.hero });
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

    // Menu config
    fetch("/api/admin/menu-config")
      .then((r) => r.json())
      .then((data) => setMenuConfig({ ...MENU_CONFIG_DEFAULTS, ...data }));

    // POS config (table count)
    fetch("/api/admin/pos-config")
      .then((r) => r.json())
      .then((d) => { if (typeof d.tableCount === "number") setTableCount(d.tableCount); });

    // Cash users
    fetch("/api/admin/cash-users")
      .then((r) => r.json())
      .then((d) => setCashUsers(d.users ?? []))
      .finally(() => setCashUsersLoading(false));

    // Categories
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .finally(() => setCatsLoading(false));
  }, []);

  // ── Handlers: logo ───────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (logoUrl) formData.append("oldImageUrl", logoUrl);
      const res = await fetch("/api/admin/upload?folder=logo", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setLogoUrl(data.url);
        await fetch("/api/admin/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl: data.url }),
        });
      }
    } finally {
      setUploadingLogo(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    if (!logoUrl) return;
    fetch("/api/admin/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: logoUrl }),
    }).catch(console.error);
    setLogoUrl("");
    await fetch("/api/admin/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: "" }),
    });
  }

  // ── Handlers: theme ──────────────────────────────────────────────
  async function handleSaveTheme(e: React.FormEvent) {
    e.preventDefault();
    setSavingTheme(true);
    try {
      await fetch("/api/admin/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      setSavedTheme(true);
      setTimeout(() => setSavedTheme(false), 3000);
    } finally {
      setSavingTheme(false);
    }
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (theme.heroImageUrl) formData.append("oldImageUrl", theme.heroImageUrl);
      const res = await fetch("/api/admin/upload?folder=hero", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setTheme((prev) => ({ ...prev, heroImageUrl: data.url }));
    } finally {
      setUploadingHero(false);
      if (heroFileRef.current) heroFileRef.current.value = "";
    }
  }

  async function handleRemoveHero() {
    if (!theme.heroImageUrl) return;
    fetch("/api/admin/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: theme.heroImageUrl }),
    }).catch(console.error);
    setTheme((prev) => ({ ...prev, heroImageUrl: "" }));
  }

  // ── Handlers: hero text ──────────────────────────────────────────
  async function handleSaveHero(e: React.FormEvent) {
    e.preventDefault();
    setSavingHero(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero }),
      });
      setSavedHero(true);
      setTimeout(() => setSavedHero(false), 3000);
    } finally {
      setSavingHero(false);
    }
  }

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

  // ── Handlers: menu background image ─────────────────────────────
  async function handleMenuBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMenuBg(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (menuConfig.bgImageUrl) formData.append("oldImageUrl", menuConfig.bgImageUrl);
      const res = await fetch("/api/admin/upload?folder=menu", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setMenuConfig((prev) => ({ ...prev, bgImageUrl: data.url }));
    } finally {
      setUploadingMenuBg(false);
      if (menuBgFileRef.current) menuBgFileRef.current.value = "";
    }
  }

  async function handleRemoveMenuBg() {
    if (!menuConfig.bgImageUrl) return;
    fetch("/api/admin/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: menuConfig.bgImageUrl }),
    }).catch(console.error);
    setMenuConfig((prev) => ({ ...prev, bgImageUrl: "" }));
  }

  // ── Handlers: menu config ────────────────────────────────────────
  async function handleSaveMenuConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingMenu(true);
    try {
      await fetch("/api/admin/menu-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(menuConfig),
      });
      setSavedMenu(true);
      setTimeout(() => setSavedMenu(false), 3000);
    } finally {
      setSavingMenu(false);
    }
  }

  // ── Handlers: table count ────────────────────────────────────────
  async function handleSaveTableCount(e: React.FormEvent) {
    e.preventDefault();
    setSavingTables(true);
    try {
      await fetch("/api/admin/pos-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCount }),
      });
      setSavedTables(true);
      setTimeout(() => setSavedTables(false), 3000);
    } finally {
      setSavingTables(false);
    }
  }

  // ── Handlers: cash users ─────────────────────────────────────────
  async function handleAddCashUser(e: React.FormEvent) {
    e.preventDefault();
    const name = newCashUserName.trim();
    if (!name) return;
    setAddingCashUser(true);
    try {
      const r = await fetch("/api/admin/cash-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.user) {
        setCashUsers((prev) => [...prev, d.user]);
        setNewCashUserName("");
      }
    } finally {
      setAddingCashUser(false);
    }
  }

  async function handleSaveCashUserName(id: string) {
    const name = editingCashUserName.trim();
    if (!name) return;
    await fetch(`/api/admin/cash-users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCashUsers((prev) => prev.map((u) => (u._id === id ? { ...u, name } : u)));
    setEditingCashUserId(null);
  }

  async function handleDeleteCashUser(id: string) {
    setDeletingCashUserId(id);
    try {
      await fetch(`/api/admin/cash-users/${id}`, { method: "DELETE" });
      setCashUsers((prev) => prev.filter((u) => u._id !== id));
    } finally {
      setDeletingCashUserId(null);
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

  if (loadingAbout || loadingSocial || loadingTheme) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  const TABS = [
    { key: "marca",    label: "Marca",    icon: "🎨", title: "Identidad de marca",      desc: "Logo, colores, tipografía y apariencia visual de tu tienda." },
    { key: "portada",  label: "Portada",  icon: "🏠", title: "Portada y contacto",       desc: "Texto principal de la tienda y redes sociales." },
    { key: "nosotros", label: "Nosotros", icon: "👥", title: "Sección Nosotros",          desc: "Texto e imágenes de la sección \"Nosotros\" en tu tienda." },
    { key: "productos",label: "Productos",icon: "📦", title: "Categorías de productos",  desc: "Administrá las categorías para organizar tu catálogo." },
    { key: "menu",     label: "Menú",     icon: "🍽", title: "Menú público",             desc: "Configurá la página de menú que ven tus clientes." },
    { key: "caja",     label: "Caja",     icon: "🧑‍💼", title: "Usuarios de caja",          desc: "Personas que pueden atender el punto de venta." },
  ] as const;

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* ── Barra de tabs ── */}
      <div className="flex overflow-x-auto gap-0.5 -mx-4 px-4 border-b border-brand-muted mb-6 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
              activeTab === tab.key
                ? "border-brand-pink text-brand-pink"
                : "border-transparent text-brand-dark/50 hover:text-brand-dark hover:border-brand-muted"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Título del tab activo ── */}
      <div className="mb-6">
        <h1 className="font-brand text-xl font-bold text-brand-dark">{currentTab.title}</h1>
        <p className="text-sm text-brand-dark/50 mt-0.5">{currentTab.desc}</p>
      </div>

      <div className="space-y-6">

      {/* ── TAB: MARCA ── Logo + Apariencia ─────────────────────────── */}
      {activeTab === "marca" && <>

      {/* ── Logo ────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-brand-dark text-lg">Logo de tu tienda</h2>
          <p className="text-sm text-brand-dark/50 mt-0.5">
            Aparece en la portada y en el panel de login de tu tienda.
          </p>
        </div>

        <input
          ref={logoFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleLogoUpload}
        />

        {logoUrl ? (
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-brand-muted shadow-sm shrink-0">
              <Image src={logoUrl} alt="Logo" fill className="object-cover" sizes="80px" />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => logoFileRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Cambiar logo
              </Button>
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-xs text-red-400 hover:text-red-600 transition-colors underline text-left"
              >
                Eliminar logo
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => logoFileRef.current?.click()}
            disabled={uploadingLogo}
            className="w-full border-2 border-dashed border-brand-muted rounded-xl p-6 flex flex-col items-center gap-2 hover:border-brand-pink/40 hover:bg-brand-pink/5 transition-all"
          >
            {uploadingLogo ? (
              <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-brand-dark/30" />
                <span className="text-sm text-brand-dark/40">Subir logo</span>
                <span className="text-xs text-brand-dark/30">JPG, PNG, WebP — máx 5 MB</span>
              </>
            )}
          </button>
        )}
      </section>

      {/* ── Apariencia ──────────────────────────────────────────────── */}
      <form onSubmit={handleSaveTheme}>
        <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-brand-pink" />
            <div>
              <h2 className="font-semibold text-brand-dark text-lg">Apariencia de tu tienda</h2>
              <p className="text-sm text-brand-dark/50 mt-0.5">
                Personalizá los colores, tipografía y fondo de tu tienda.
              </p>
            </div>
          </div>

          {/* Colores de marca */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-3">Colores de tu marca</label>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { key: "primaryColor",   label: "Principal" },
                  { key: "secondaryColor", label: "Secundario" },
                  { key: "accentColor",    label: "Acento" },
                ] as { key: keyof ThemeData; label: string }[]
              ).map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center gap-2">
                  <div className="relative w-12 h-12 rounded-xl border-2 border-brand-muted shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                    <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ backgroundColor: theme[key] as string }} />
                    <input
                      type="color"
                      value={theme[key] as string}
                      onChange={(e) => setTheme((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                    />
                  </div>
                  <span className="text-xs text-brand-dark/60 font-medium">{label}</span>
                  <span className="text-xs text-brand-dark/40 font-mono">{theme[key] as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Color de fondo */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Color de fondo de la tienda</label>
            <p className="text-xs text-brand-dark/40 mb-3">Se aplica al fondo de las secciones de contenido. Se ignora si el modo oscuro está activo.</p>
            <div className="flex items-center gap-3">
              <div className={`relative w-12 h-12 rounded-xl border-2 border-brand-muted shadow-sm transition-opacity ${theme.darkMode ? "opacity-40 pointer-events-none" : "hover:shadow-md cursor-pointer"}`}>
                <div className="absolute inset-0 rounded-xl border border-brand-muted/50 pointer-events-none" style={{ backgroundColor: theme.backgroundColor }} />
                <input
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                  disabled={theme.darkMode}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                />
              </div>
              <span className="text-sm text-brand-dark/60 font-mono">{theme.backgroundColor}</span>
            </div>
          </div>

          {/* Modo oscuro */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Modo oscuro</label>
            <p className="text-xs text-brand-dark/40 mb-3">Activa un fondo oscuro para toda la tienda. Ideal para marcas con identidad oscura.</p>
            <button
              type="button"
              role="switch"
              aria-checked={theme.darkMode}
              onClick={() => setTheme((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-pink focus:ring-offset-2 ${theme.darkMode ? "gradient-bg" : "bg-brand-muted"}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${theme.darkMode ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
            <span className="ml-3 text-sm text-brand-dark/60">{theme.darkMode ? "Activo" : "Inactivo"}</span>
          </div>

          {/* Tipografía */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-3">Tipografía</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTheme((prev) => ({ ...prev, fontFamily: opt.key }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    theme.fontFamily === opt.key
                      ? "border-brand-pink bg-brand-pink/5"
                      : "border-brand-muted hover:border-brand-pink/30"
                  }`}
                >
                  <p className="text-lg font-bold text-brand-dark" style={{ fontFamily: opt.css }}>Aa</p>
                  <p className="text-xs text-brand-dark/50 mt-1 truncate">{opt.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Forma del logo */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-3">Forma del logo</label>
            <div className="flex flex-wrap gap-3">
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTheme((prev) => ({ ...prev, logoShape: opt.key }))}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-w-[72px] ${
                    theme.logoShape === opt.key
                      ? "border-brand-pink bg-brand-pink/5"
                      : "border-brand-muted hover:border-brand-pink/30"
                  }`}
                >
                  <div className={`w-10 h-10 bg-brand-muted border-2 border-brand-dark/10 ${opt.borderClass}`} />
                  <span className="text-xs text-brand-dark/60 text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color de fondo del logo */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Color de fondo del logo</label>
            <p className="text-xs text-brand-dark/40 mb-3">Opcional — aparece detrás del logo en el pie de página.</p>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl border-2 border-brand-muted shadow-sm hover:shadow-md cursor-pointer transition-shadow">
                <div
                  className="absolute inset-0 rounded-xl border border-brand-muted/50 pointer-events-none"
                  style={{ backgroundColor: theme.logoBgColor || "#FFFFFF" }}
                />
                <input
                  type="color"
                  value={theme.logoBgColor || "#FFFFFF"}
                  onChange={(e) => setTheme((prev) => ({ ...prev, logoBgColor: e.target.value }))}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                />
              </div>
              {theme.logoBgColor && (
                <button
                  type="button"
                  onClick={() => setTheme((prev) => ({ ...prev, logoBgColor: "" }))}
                  className="text-xs text-brand-dark/40 hover:text-red-500 transition-colors underline"
                >
                  Quitar
                </button>
              )}
              {!theme.logoBgColor && (
                <span className="text-xs text-brand-dark/40">Sin color de fondo</span>
              )}
            </div>
          </div>

          {/* Imagen de fondo del hero */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Imagen de fondo del hero</label>
            <p className="text-xs text-brand-dark/40 mb-3">
              Se muestra detrás del texto principal con el color de tu marca al 70% de opacidad.
            </p>
            <input
              ref={heroFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleHeroUpload}
            />
            {theme.heroImageUrl ? (
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-brand-muted shrink-0">
                  <Image src={theme.heroImageUrl} alt="Hero" fill className="object-cover" sizes="80px" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => heroFileRef.current?.click()}
                    disabled={uploadingHero}
                  >
                    {uploadingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Cambiar
                  </Button>
                  <button
                    type="button"
                    onClick={handleRemoveHero}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors underline text-left"
                  >
                    Eliminar imagen
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => heroFileRef.current?.click()}
                disabled={uploadingHero}
                className="w-full border-2 border-dashed border-brand-muted rounded-xl p-6 flex flex-col items-center gap-2 hover:border-brand-pink/40 hover:bg-brand-pink/5 transition-all"
              >
                {uploadingHero ? (
                  <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-brand-dark/30" />
                    <span className="text-sm text-brand-dark/40">Subir imagen de fondo</span>
                    <span className="text-xs text-brand-dark/30">JPG, PNG, WebP — máx 5 MB</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={savingTheme} className="flex-1">
              {savingTheme ? "Guardando..." : "Guardar apariencia"}
            </Button>
            {savedTheme && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <Check className="w-4 h-4" /> Guardado
              </span>
            )}
          </div>
        </section>
      </form>

      </>}

      {/* ── TAB: PORTADA ── Hero + Redes Sociales ───────────────────── */}
      {activeTab === "portada" && <>

      {/* ── Hero (texto de portada) ─────────────────────────────────── */}
      <form onSubmit={handleSaveHero}>
        <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-brand-dark text-lg">Texto de portada</h2>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              El texto principal que ven tus clientes al entrar a tu tienda.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">
                Eslogan principal
              </label>
              <input
                type="text"
                value={hero.tagline}
                onChange={(e) => setHero((prev) => ({ ...prev, tagline: e.target.value }))}
                placeholder="Tu tienda en línea, siempre disponible"
                className="w-full px-3 py-2 text-sm border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/30 placeholder:text-brand-dark/25"
              />
              <p className="text-xs text-brand-dark/40 mt-1">Frase corta que describe tu negocio.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">
                Subtítulo
              </label>
              <input
                type="text"
                value={hero.subtagline}
                onChange={(e) => setHero((prev) => ({ ...prev, subtagline: e.target.value }))}
                placeholder="Pedidos fáciles y rápidos por WhatsApp"
                className="w-full px-3 py-2 text-sm border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/30 placeholder:text-brand-dark/25"
              />
              <p className="text-xs text-brand-dark/40 mt-1">Descripción de apoyo debajo del eslogan.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">
                Badge / etiqueta
              </label>
              <input
                type="text"
                value={hero.badge}
                onChange={(e) => setHero((prev) => ({ ...prev, badge: e.target.value }))}
                placeholder="📦 Pedidos por encargo"
                className="w-full px-3 py-2 text-sm border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/30 placeholder:text-brand-dark/25"
              />
              <p className="text-xs text-brand-dark/40 mt-1">Etiqueta pequeña que aparece sobre el nombre (podés incluir un emoji).</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={savingHero} className="flex-1">
              {savingHero ? "Guardando..." : "Guardar texto de portada"}
            </Button>
            {savedHero && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <Check className="w-4 h-4" /> Guardado
              </span>
            )}
          </div>
        </section>
      </form>

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

      </>}

      {/* ── TAB: NOSOTROS ── Sección About ──────────────────────────── */}
      {activeTab === "nosotros" && <>

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

      </>}

      {/* ── TAB: PRODUCTOS ── Categorías ────────────────────────────── */}
      {activeTab === "productos" && <>

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

      </>}

      {/* ── TAB: MENÚ ── Configuración del menú público ─────────────── */}
      {activeTab === "menu" && <>

      {/* ── Menú público ────────────────────────────────────────────── */}
      <form onSubmit={handleSaveMenuConfig}>
        <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-brand-dark text-lg">Menú público de productos</h2>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              Configurá cómo se ve la página{" "}
              <span className="font-mono text-brand-pink">/{"{tu-tienda}"}/menu</span> para tus clientes.
            </p>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Título del menú
            </label>
            <input
              type="text"
              maxLength={120}
              placeholder="Ej: Nuestro menú"
              value={menuConfig.title}
              onChange={(e) => setMenuConfig((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Descripción del menú
            </label>
            <textarea
              maxLength={300}
              rows={2}
              placeholder="Ej: Productos frescos preparados con amor cada día."
              value={menuConfig.description}
              onChange={(e) => setMenuConfig((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          {/* Tipografía */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-3">
              Tipografía del menú
            </label>
            <div className="grid grid-cols-1 gap-2">
              {FONT_OPTIONS.map(({ key, label, css }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMenuConfig((prev) => ({ ...prev, fontFamily: key }))}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-left ${
                    menuConfig.fontFamily === key
                      ? "border-brand-pink bg-brand-pink/10"
                      : "border-brand-muted hover:border-brand-pink/40"
                  }`}
                >
                  <span
                    className="text-sm font-medium text-brand-dark"
                    style={{ fontFamily: css }}
                  >
                    {label}
                  </span>
                  <span className="text-xs text-brand-dark/40" style={{ fontFamily: css }}>
                    Aa Bb Cc
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Columnas */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-3">
              Columnas por fila
            </label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMenuConfig((prev) => ({ ...prev, columns: n }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    menuConfig.columns === n
                      ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                      : "border-brand-muted text-brand-dark/50 hover:border-brand-pink/40"
                  }`}
                >
                  {n} {n === 1 ? "columna" : "columnas"}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Mostrar en cada producto
            </label>
            {(
              [
                { key: "showImage", label: "Imagen del producto" },
                { key: "showPrice", label: "Precio" },
              ] as { key: keyof Pick<MenuConfigData, "showImage" | "showPrice">; label: string }[]
            ).map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-brand-muted cursor-pointer hover:bg-brand-muted/20 transition-colors"
              >
                <span className="text-sm text-brand-dark">{label}</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={menuConfig[key]}
                    onChange={(e) => setMenuConfig((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <div
                    className={`w-10 h-5 rounded-full transition-colors ${
                      menuConfig[key] ? "bg-brand-pink" : "bg-gray-200"
                    }`}
                  />
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      menuConfig[key] ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </label>
            ))}
          </div>

          {/* Paleta de colores del menú */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Paleta de colores del menú
            </label>
            <p className="text-xs text-brand-dark/40 mb-3">
              Si dejás un color sin definir, se usa el color del tema principal de tu tienda.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { key: "primaryColor",   label: "Principal" },
                  { key: "secondaryColor", label: "Secundario" },
                  { key: "accentColor",    label: "Acento" },
                ] as { key: keyof Pick<MenuConfigData, "primaryColor" | "secondaryColor" | "accentColor">; label: string }[]
              ).map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center gap-2">
                  <div
                    className="relative w-12 h-12 rounded-xl border-2 border-brand-muted shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    style={{ backgroundColor: menuConfig[key] || "#e5e7eb" }}
                  >
                    <input
                      type="color"
                      value={menuConfig[key] || "#6366f1"}
                      onChange={(e) => setMenuConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                    />
                  </div>
                  <span className="text-xs text-brand-dark/60 font-medium">{label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-brand-dark/40 font-mono">
                      {menuConfig[key] || "—"}
                    </span>
                    {menuConfig[key] && (
                      <button
                        type="button"
                        onClick={() => setMenuConfig((prev) => ({ ...prev, [key]: "" }))}
                        className="text-brand-dark/30 hover:text-red-400 transition-colors"
                        title="Usar color del tema"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Imagen de fondo */}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-3">
              Imagen de fondo del menú
            </label>
            <input
              ref={menuBgFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleMenuBgUpload}
            />
            {menuConfig.bgImageUrl ? (
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-14 rounded-xl overflow-hidden border-2 border-brand-muted shadow-sm shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={menuConfig.bgImageUrl}
                    alt="Fondo del menú"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => menuBgFileRef.current?.click()}
                    disabled={uploadingMenuBg}
                  >
                    {uploadingMenuBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Cambiar imagen
                  </Button>
                  <button
                    type="button"
                    onClick={handleRemoveMenuBg}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors underline text-left"
                  >
                    Eliminar fondo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => menuBgFileRef.current?.click()}
                disabled={uploadingMenuBg}
                className="w-full border-2 border-dashed border-brand-muted rounded-xl p-5 flex flex-col items-center gap-2 hover:border-brand-pink/40 hover:bg-brand-pink/5 transition-all"
              >
                {uploadingMenuBg ? (
                  <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-brand-dark/30" />
                    <span className="text-sm text-brand-dark/40">Subir imagen de fondo</span>
                    <span className="text-xs text-brand-dark/30">JPG, PNG, WebP — máx 5 MB</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Difuminado del fondo */}
          <div className={menuConfig.bgImageUrl ? "" : "opacity-40 pointer-events-none"}>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-brand-dark">
                Difuminado del fondo
              </label>
              <span className="text-sm font-semibold text-brand-pink tabular-nums">
                {menuConfig.bgBlur}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={menuConfig.bgBlur}
              onChange={(e) =>
                setMenuConfig((prev) => ({ ...prev, bgBlur: Number(e.target.value) }))
              }
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-brand-pink) 0%, var(--color-brand-pink) ${menuConfig.bgBlur}%, #e5e7eb ${menuConfig.bgBlur}%, #e5e7eb 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-brand-dark/30 mt-1">
              <span>Sin difuminar</span>
              <span>Muy difuminado</span>
            </div>
          </div>

          <Button type="submit" disabled={savingMenu} className="w-full sm:w-auto">
            {savingMenu ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedMenu ? (
              <Check className="w-4 h-4" />
            ) : null}
            {savedMenu ? "¡Guardado!" : "Guardar configuración del menú"}
          </Button>
        </section>
      </form>

      </>}

      {/* ── TAB: CAJA ── Usuarios de caja ───────────────────────────── */}
      {activeTab === "caja" && <>

      <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-brand-dark text-lg">Usuarios de caja</h2>
          <p className="text-sm text-brand-dark/50 mt-0.5">
            Estos nombres aparecen en el Punto de venta para identificar quién atendió cada venta.
          </p>
        </div>

        {cashUsersLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-brand-pink" />
          </div>
        ) : (
          <div className="space-y-2">
            {cashUsers.length === 0 && (
              <p className="text-sm text-brand-dark/40 italic">No hay usuarios de caja aún.</p>
            )}
            {cashUsers.map((u) => (
              <div
                key={u._id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-brand-muted bg-brand-muted/10"
              >
                {editingCashUserId === u._id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingCashUserName}
                    onChange={(e) => setEditingCashUserName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveCashUserName(u._id);
                      if (e.key === "Escape") setEditingCashUserId(null);
                    }}
                    className="flex-1 border border-brand-pink rounded-lg px-2 py-1 text-sm focus:outline-none"
                  />
                ) : (
                  <span className="text-sm text-brand-dark flex-1">{u.name}</span>
                )}
                <div className="flex items-center gap-1">
                  {editingCashUserId === u._id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSaveCashUserName(u._id)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCashUserId(null)}
                        className="p-1.5 rounded-lg text-brand-dark/30 hover:bg-gray-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingCashUserId(u._id); setEditingCashUserName(u.name); }}
                      className="p-1.5 rounded-lg text-brand-dark/30 hover:text-brand-dark hover:bg-brand-muted/30 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteCashUser(u._id)}
                    disabled={deletingCashUserId === u._id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/30 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deletingCashUserId === u._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddCashUser} className="flex gap-2">
          <input
            type="text"
            value={newCashUserName}
            onChange={(e) => setNewCashUserName(e.target.value)}
            placeholder="Nombre del usuario..."
            className="flex-1 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
          <Button type="submit" disabled={addingCashUser || !newCashUserName.trim()} size="sm">
            {addingCashUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </form>
      </section>

      {/* Configuración de mesas */}
      <form onSubmit={handleSaveTableCount}>
        <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-brand-dark text-lg">Configuración de mesas</h2>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              Definí cuántas mesas tiene tu local. El Punto de venta mostrará un selector "Mesa 1", "Mesa 2"…
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-brand-dark mb-1">
                Número de mesas disponibles
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={tableCount}
                onChange={(e) => setTableCount(Math.max(0, Math.round(Number(e.target.value))))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                placeholder="0 = sin mesas"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={savingTables} size="sm">
              {savingTables ? <Loader2 className="w-4 h-4 animate-spin" /> : savedTables ? <Check className="w-4 h-4" /> : null}
              {savedTables ? "¡Guardado!" : "Guardar mesas"}
            </Button>
          </div>
        </section>
      </form>

      </>}

      </div>
    </div>
  );
}
