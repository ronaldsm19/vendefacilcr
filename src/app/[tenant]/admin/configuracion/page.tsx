"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import {
  Upload, X, Loader2, Check, Plus, Trash2, Phone, Palette, GripVertical, ChevronUp, ChevronDown, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TicketPreview from "@/components/admin/TicketPreview";
import PrintQueueSection from "@/components/admin/PrintQueueSection";
import {
  buildSaleRows, buildCashCloseRows, DEFAULT_TICKET_CONFIG,
  type TicketConfigData, type SaleTicketData, type CashCloseTicketData,
} from "@/lib/ticket";
import { useAdminSession } from "@/components/admin/SessionContext";
import { DEFAULT_COMANDA_CONFIG, readComandaConfig, type ComandaConfigData } from "@/lib/comandaConfig";
import { DEFAULT_POS_CHARGES, readPosCharges, type PosCharges } from "@/lib/pricing";
import {
  EMPTY_PRODUCTS_SECTION, PRODUCTS_SECTION_FALLBACK, PRODUCTS_SECTION_LIMITS, productsSectionForDisplay,
  readProductsSectionText, type ProductsSectionText,
} from "@/lib/storeTexts";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Category {
  _id: string;
  label: string;
  order: number;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-pink focus:ring-offset-2 ${checked ? "gradient-bg" : "bg-brand-muted"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SortableCategoryRow({
  category, onDelete, onMoveUp, onMoveDown, isFirst, isLast, deleting,
}: {
  category: Category;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-muted bg-brand-muted/10"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 -ml-1 text-brand-dark/30 hover:text-brand-dark/60 cursor-grab active:cursor-grabbing touch-none shrink-0"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="flex-1 min-w-0 text-sm text-brand-dark truncate">{category.label}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onMoveUp(category._id)}
          disabled={isFirst}
          className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/30 hover:text-brand-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Subir"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(category._id)}
          disabled={isLast}
          className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/30 hover:text-brand-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Bajar"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <Button
          type="button"
          size="icon-sm"
          variant="destructive"
          title="Eliminar categoría"
          aria-label="Eliminar categoría"
          onClick={() => onDelete(category._id)}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
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

// ── Datos de ejemplo para las previas del Ticket electrónico ──────
const MOCK_SALE: SaleTicketData = {
  businessName: "Mi Negocio",
  ticketNumber: 1024,
  saleNumber: "ABC123",
  date: new Date(),
  cashUserName: "María Pérez",
  customerName: "Cliente",
  items: [
    { productName: "Café americano", quantity: 2, unitPrice: 1500, lineTotal: 3000 },
    { productName: "Croissant",       quantity: 1, unitPrice: 1800, lineTotal: 1800 },
  ],
  subtotal: 4800,
  ivaEnabled: true,
  ivaRate: 13,
  ivaAmount: 624,
  serviceEnabled: true,
  serviceRate: 10,
  serviceAmount: 480,
  total: 5904,
  paymentMethod: "efectivo",
};

const MOCK_CASH_CLOSE: CashCloseTicketData = {
  businessName: "Mi Negocio",
  closeNumber: 12,
  date: new Date(),
  closedBy: "María Pérez",
  paymentBreakdown: { efectivo: 25000, sinpe: 8000, tarjeta: 12000 },
  salesTotal: 45000,
  expensesTotal: 2000,
  profit: 30000,
  arqueo: { totalContado: 29800, totalEsperado: 30000, diferencia: -200 },
  productsSummary: [
    { productName: "Café americano", unitsSold: 12 },
    { productName: "Croissant",       unitsSold: 6 },
  ],
  openingAmount: 25000,
  withdrawals: [{ amount: 20000, leftAmount: 25000, note: "Depósito banco", date: new Date() }],
  withdrawalsTotal: 20000,
  cashLeft: 25000,
  salesList: [
    { ticketNumber: 1023, total: 5904 },
    { ticketNumber: 1024, total: 5904 },
  ],
  notes: "",
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
  const session = useAdminSession();
  const showComandas = session.role === "admin" && session.isPremium;

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

  // ── Textos de la sección de productos de la tienda ───────────────
  const [productsText, setProductsText] = useState<ProductsSectionText>(EMPTY_PRODUCTS_SECTION);
  const [savingProductsText, setSavingProductsText] = useState(false);
  const [savedProductsText, setSavedProductsText] = useState(false);
  const [productsTextError, setProductsTextError] = useState<string | null>(null);

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

  // ── Ticket config state ──────────────────────────────────────────
  const [ticketConfig, setTicketConfig] = useState<TicketConfigData>(DEFAULT_TICKET_CONFIG);
  const [savingTicket, setSavingTicket] = useState(false);
  const [savedTicket, setSavedTicket] = useState(false);

  // ── Comanda config state ─────────────────────────────────────────
  const [comandaConfig, setComandaConfig] = useState<ComandaConfigData>(DEFAULT_COMANDA_CONFIG);
  const [savingComanda, setSavingComanda] = useState(false);
  const [savedComanda, setSavedComanda] = useState(false);
  const [comandaError, setComandaError] = useState<string | null>(null);

  // ── Sale delete password state (Fase 7) ───────────────────────────
  const [saleDeleteConfigured, setSaleDeleteConfigured] = useState(false);
  const [loadingSaleDeletePw, setLoadingSaleDeletePw] = useState(true);
  const [newSaleDeletePw, setNewSaleDeletePw] = useState("");
  const [confirmSaleDeletePw, setConfirmSaleDeletePw] = useState("");
  const [savingSaleDeletePw, setSavingSaleDeletePw] = useState(false);
  const [removingSaleDeletePw, setRemovingSaleDeletePw] = useState(false);
  const [saleDeletePwError, setSaleDeletePwError] = useState<string | null>(null);
  const [savedSaleDeletePw, setSavedSaleDeletePw] = useState(false);

  // ── Cobros del punto de venta (impuesto, servicio, propina) ──────
  const [posCharges, setPosCharges] = useState<PosCharges>(DEFAULT_POS_CHARGES);
  const [ivaRateInput, setIvaRateInput] = useState(String(DEFAULT_POS_CHARGES.ivaRate));
  const [serviceRateInput, setServiceRateInput] = useState(String(DEFAULT_POS_CHARGES.serviceRate));
  const [loadingPosCharges, setLoadingPosCharges] = useState(true);
  const [savingPosCharges, setSavingPosCharges] = useState(false);
  const [savedPosCharges, setSavedPosCharges] = useState(false);
  const [posChargesError, setPosChargesError] = useState<string | null>(null);

  // ── Tab state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"marca" | "portada" | "nosotros" | "productos" | "menu" | "ticket" | "comandas" | "caja">("marca");

  // ── Categories state ─────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [savingCatOrder, setSavingCatOrder] = useState(false);
  const [catOrderError, setCatOrderError] = useState<string | null>(null);
  const [failedCatOrder, setFailedCatOrder] = useState<Category[] | null>(null);
  const catSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
        if (data?.productsSection) setProductsText(readProductsSectionText(data.productsSection));
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

    // Categories
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .finally(() => setCatsLoading(false));

    // Ticket config
    fetch("/api/admin/ticket-config")
      .then((r) => r.json())
      .then((d) => setTicketConfig({ ...DEFAULT_TICKET_CONFIG, ...(d.ticketConfig ?? {}) }));

    // Comanda config (403 si no es admin premium; se ignora)
    fetch("/api/admin/comanda-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setComandaConfig(readComandaConfig(d)); });

    // Cobros del punto de venta
    fetch("/api/admin/pos-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const c = readPosCharges(d);
        setPosCharges(c);
        setIvaRateInput(String(c.ivaRate));
        setServiceRateInput(String(c.serviceRate));
      })
      .finally(() => setLoadingPosCharges(false));

    // Contraseña de eliminación de ventas — nunca trae la contraseña, solo si está configurada
    fetch("/api/admin/sale-delete-password")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSaleDeleteConfigured(!!d.configured); })
      .finally(() => setLoadingSaleDeletePw(false));
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

  // ── Handlers: textos de la sección de productos ──────────────────
  async function handleSaveProductsText(e: React.FormEvent) {
    e.preventDefault();
    setSavingProductsText(true);
    setProductsTextError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productsSection: productsText }),
      });
      if (!res.ok) {
        setProductsTextError("No se pudieron guardar los textos. Intentá de nuevo.");
        return;
      }
      setSavedProductsText(true);
      setTimeout(() => setSavedProductsText(false), 3000);
    } finally {
      setSavingProductsText(false);
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

  // ── Handlers: ticket config ──────────────────────────────────────
  async function handleSaveTicketConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingTicket(true);
    try {
      await fetch("/api/admin/ticket-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketConfig),
      });
      setSavedTicket(true);
      setTimeout(() => setSavedTicket(false), 3000);
    } finally {
      setSavingTicket(false);
    }
  }


  // ── Handlers: comanda config ─────────────────────────────────────
  async function handleSaveComandaConfig(e: React.FormEvent) {
    e.preventDefault();
    setComandaError(null);
    if (comandaConfig.warnMinutes >= comandaConfig.alertMinutes) {
      setComandaError("El umbral de aviso debe ser menor que el de alerta.");
      return;
    }
    setSavingComanda(true);
    try {
      const res = await fetch("/api/admin/comanda-config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comandaConfig),
      });
      const data = await res.json();
      if (!res.ok) { setComandaError(data.error ?? "No se pudo guardar"); return; }
      setSavedComanda(true);
      setTimeout(() => setSavedComanda(false), 3000);
    } finally { setSavingComanda(false); }
  }

  // ── Handlers: sale delete password (Fase 7) ───────────────────────
  async function handleSaveSaleDeletePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaleDeletePwError(null);
    if (newSaleDeletePw.length < 4) {
      setSaleDeletePwError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (newSaleDeletePw !== confirmSaleDeletePw) {
      setSaleDeletePwError("Las contraseñas no coinciden.");
      return;
    }
    setSavingSaleDeletePw(true);
    try {
      const res = await fetch("/api/admin/sale-delete-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newSaleDeletePw }),
      });
      const data = await res.json();
      if (!res.ok) { setSaleDeletePwError(data.error ?? "No se pudo guardar"); return; }
      setSaleDeleteConfigured(true);
      setNewSaleDeletePw("");
      setConfirmSaleDeletePw("");
      setSavedSaleDeletePw(true);
      setTimeout(() => setSavedSaleDeletePw(false), 3000);
    } finally { setSavingSaleDeletePw(false); }
  }

  async function handleSavePosCharges(e: React.FormEvent) {
    e.preventDefault();
    setPosChargesError(null);
    const ivaRate = Number(ivaRateInput);
    const serviceRate = Number(serviceRateInput);
    for (const [label, v] of [["impuesto", ivaRate], ["servicio", serviceRate]] as const) {
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        setPosChargesError(`El porcentaje de ${label} debe estar entre 0 y 100.`);
        return;
      }
    }
    setSavingPosCharges(true);
    try {
      const res = await fetch("/api/admin/pos-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...posCharges, ivaRate, serviceRate }),
      });
      const data = await res.json();
      if (!res.ok) { setPosChargesError(data.error ?? "No se pudo guardar"); return; }
      const c = readPosCharges(data);
      setPosCharges(c);
      setIvaRateInput(String(c.ivaRate));
      setServiceRateInput(String(c.serviceRate));
      setSavedPosCharges(true);
      setTimeout(() => setSavedPosCharges(false), 3000);
    } finally { setSavingPosCharges(false); }
  }

  async function handleRemoveSaleDeletePassword() {
    setSaleDeletePwError(null);
    setRemovingSaleDeletePw(true);
    try {
      const res = await fetch("/api/admin/sale-delete-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: null }),
      });
      const data = await res.json();
      if (!res.ok) { setSaleDeletePwError(data.error ?? "No se pudo quitar"); return; }
      setSaleDeleteConfigured(false);
    } finally { setRemovingSaleDeletePw(false); }
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
        // Una categoría nueva ya viene con el order correcto (al final) desde la API —
        // no hay que reordenar acá, solo agregarla donde corresponde.
        setCategories((prev) => [...prev, d.category]);
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

  // ── Handlers: orden de categorías ─────────────────────────────────
  async function saveCategoryOrder(newList: Category[]) {
    const previous = categories;
    setCategories(newList);
    setSavingCatOrder(true);
    setCatOrderError(null);
    setFailedCatOrder(null);
    try {
      const res = await fetch("/api/admin/categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: newList.map((c) => c._id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCategories(previous);
        setFailedCatOrder(newList);
        setCatOrderError(data.error ?? "No se pudo guardar el orden");
      }
    } catch {
      setCategories(previous);
      setFailedCatOrder(newList);
      setCatOrderError("No se pudo guardar el orden — revisá tu conexión");
    } finally {
      setSavingCatOrder(false);
    }
  }

  function retryCategoryOrder() {
    if (failedCatOrder) saveCategoryOrder(failedCatOrder);
  }

  function moveCategory(id: string, direction: -1 | 1) {
    const index = categories.findIndex((c) => c._id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= categories.length) return;
    saveCategoryOrder(arrayMove(categories, index, target));
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c._id === active.id);
    const newIndex = categories.findIndex((c) => c._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    saveCategoryOrder(arrayMove(categories, oldIndex, newIndex));
  }

  const saleTicketRows = useMemo(() => buildSaleRows(MOCK_SALE, ticketConfig), [ticketConfig]);
  const cashCloseTicketRows = useMemo(() => buildCashCloseRows(MOCK_CASH_CLOSE, ticketConfig), [ticketConfig]);

  if (loadingAbout || loadingSocial || loadingTheme) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  const ALL_TABS = [
    { key: "marca",    label: "Marca",    icon: "🎨", title: "Identidad de marca",      desc: "Logo, colores, tipografía y apariencia visual de tu tienda." },
    { key: "portada",  label: "Portada",  icon: "🏠", title: "Portada y contacto",       desc: "Texto principal de la tienda y redes sociales." },
    { key: "nosotros", label: "Nosotros", icon: "👥", title: "Sección Nosotros",          desc: "Texto e imágenes de la sección \"Nosotros\" en tu tienda." },
    { key: "productos",label: "Productos",icon: "📦", title: "Productos en tu tienda",              desc: "Textos de la sección de productos de tu tienda y el orden de tus familias." },
    { key: "menu",     label: "Menú",     icon: "🍽", title: "Menú público",             desc: "Configurá la página de menú que ven tus clientes." },
    { key: "comandas", label: "Comandas", icon: "⏱️", title: "Comandas",                 desc: "Umbrales de tiempo para las mesas con comandas activas." },
    { key: "ticket",   label: "Ticket",   icon: "🧾", title: "Ticket electrónico",        desc: "Datos que aparecen en tus tickets impresos." },
    { key: "caja",     label: "Caja",     icon: "🔒", title: "Caja",                     desc: "Impuesto, servicio y propina del punto de venta, y la contraseña para eliminar ventas." },
  ] as const;

  const TABS = ALL_TABS.filter((t) => t.key !== "comandas" || showComandas);
  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex min-h-full">

      {/* ── Sidebar tabs — desktop ── */}
      <div className="hidden lg:flex flex-col w-56 shrink-0 border-r border-brand-muted bg-white sticky top-0 self-start h-screen">
        <div className="px-4 py-5 border-b border-brand-muted">
          <p className="text-xs font-semibold text-brand-dark/40 uppercase tracking-widest">Configuración</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all ${
                activeTab === tab.key
                  ? "gradient-bg text-white shadow-sm"
                  : "text-brand-dark/60 hover:text-brand-dark hover:bg-brand-muted/40"
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 min-w-0">
        {/* Mobile tab bar */}
        <div className="lg:hidden flex overflow-x-auto gap-0 border-b border-brand-muted sticky top-0 bg-white z-10 scrollbar-hide">
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

        {/* Content */}
        <div className="px-4 lg:px-8 py-6">
          {/* ── Título del tab activo ── */}
          <div className="mb-6">
            <h1 className="font-brand text-xl font-bold text-brand-dark">{currentTab.title}</h1>
            <p className="text-sm text-brand-dark/50 mt-0.5">{currentTab.desc}</p>
          </div>

          <div className="space-y-6 max-w-5xl">

      {/* ── TAB: MARCA ── Logo + Apariencia ─────────────────────────── */}
      {activeTab === "marca" && <>

      {/* ── Logo ────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
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
              <Button type="button" variant="destructive" size="sm" onClick={handleRemoveLogo}>
                <Trash2 className="w-4 h-4" />
                Eliminar logo
              </Button>
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
        <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-6">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
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
            <div className="flex flex-wrap gap-3 xl:grid xl:grid-cols-4 xl:gap-3">
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
                  <Button type="button" variant="destructive" size="sm" onClick={handleRemoveHero}>
                    <Trash2 className="w-4 h-4" />
                    Eliminar imagen
                  </Button>
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
      {activeTab === "portada" && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      {/* ── Hero (texto de portada) ─────────────────────────────────── */}
      <form onSubmit={handleSaveHero}>
        <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
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
        <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
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

      </div>}

      {/* ── TAB: NOSOTROS ── Sección About ──────────────────────────── */}
      {activeTab === "nosotros" && <>

      {/* ── Sección Nosotros ────────────────────────────────────────── */}
      <form onSubmit={handleSaveAbout}>
        <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
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
                      {/* Siempre visibles (en el teléfono no hay "hover") */}
                      <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/50 to-transparent flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => fileRefs[idx].current?.click()}
                          className="p-1.5 bg-white rounded-lg"
                        >
                          <Upload className="w-3.5 h-3.5 text-brand-dark" />
                        </button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          className="rounded-lg"
                          title="Eliminar foto"
                          aria-label={`Eliminar foto ${idx + 1}`}
                          onClick={() => removeImage(idx)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
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

      {/* ── TAB: PRODUCTOS ── Textos de la sección + categorías ──────── */}
      {activeTab === "productos" && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      {/* ── Textos de la sección de productos ─────────────────────────── */}
      <form onSubmit={handleSaveProductsText}>
        <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-brand-dark text-lg">Textos de la sección de productos</h2>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              El encabezado que ven tus clientes sobre tus productos. Lo que dejes vacío usa el texto de ejemplo.
            </p>
          </div>

          {([
            { key: "eyebrow", label: "Rótulo", help: "Texto pequeño en mayúsculas sobre el título." },
            { key: "title", label: "Título", help: "Primera parte del título." },
            { key: "highlight", label: "Parte destacada", help: "Final del título, en el color de tu marca." },
            { key: "description", label: "Descripción", help: "Frase corta debajo del título." },
            { key: "badge", label: "Etiqueta (opcional)", help: "Por ejemplo \"📦 Pedidos por encargo\". Si la dejás vacía no se muestra." },
          ] as { key: keyof ProductsSectionText; label: string; help: string }[]).map((f) => (
            <div key={f.key}>
              <label htmlFor={`productos-${f.key}`} className="block text-sm font-medium text-brand-dark mb-1">{f.label}</label>
              <input
                id={`productos-${f.key}`}
                type="text"
                maxLength={PRODUCTS_SECTION_LIMITS[f.key]}
                value={productsText[f.key]}
                onChange={(e) => setProductsText((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={PRODUCTS_SECTION_FALLBACK[f.key] || "Sin etiqueta"}
                className="w-full px-3 py-2 text-sm border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/30 placeholder:text-brand-dark/25"
              />
              <p className="text-xs text-brand-dark/40 mt-1">{f.help}</p>
            </div>
          ))}

          {/* Vista previa con los mismos textos que va a mostrar la tienda */}
          {(() => {
            const preview = productsSectionForDisplay(productsText);
            return (
              <div className="rounded-xl border border-dashed border-brand-muted bg-brand-muted/20 px-4 py-5 text-center">
                <p className="text-[10px] font-semibold text-brand-dark/40 uppercase tracking-wide mb-2">Vista previa</p>
                <p className="text-xs font-semibold text-brand-pink uppercase tracking-widest">{preview.eyebrow}</p>
                <p className="font-brand text-xl font-bold text-brand-dark mt-1">
                  {preview.title}{preview.title && preview.highlight && " "}
                  {preview.highlight && <span className="gradient-text">{preview.highlight}</span>}
                </p>
                {preview.badge && (
                  <span className="inline-block mt-2 px-2.5 py-1 rounded-full bg-brand-pink/10 text-brand-pink border border-brand-pink/20 text-xs font-semibold">
                    {preview.badge}
                  </span>
                )}
                <p className="text-xs text-brand-dark/60 mt-2">{preview.description}</p>
              </div>
            );
          })()}

          {productsTextError && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{productsTextError}</p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={savingProductsText} className="flex-1">
              {savingProductsText ? "Guardando..." : "Guardar textos"}
            </Button>
            {savedProductsText && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <Check className="w-4 h-4" /> Guardado
              </span>
            )}
          </div>
        </section>
      </form>

      {/* ── Familias de productos (categorías) ────────────────────────── */}
      <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-brand-dark text-lg">Familias de productos (categorías)</h2>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              Este orden es el que van a ver la caja, la pantalla de comandas del mesero, la
              página de productos y tu tienda. Arrastrá para reordenar, o usá las flechas.
            </p>
          </div>
          {savingCatOrder && (
            <span className="flex items-center gap-1.5 text-xs text-brand-dark/40 shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
            </span>
          )}
        </div>

        {catOrderError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {catOrderError}</span>
            <button type="button" onClick={retryCategoryOrder} className="font-semibold underline shrink-0 cursor-pointer">
              Reintentar
            </button>
          </div>
        )}

        {catsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-brand-pink" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {categories.length === 0 && (
              <p className="text-sm text-brand-dark/40 italic">No hay categorías aún.</p>
            )}
            <DndContext sensors={catSensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={categories.map((c) => c._id)} strategy={verticalListSortingStrategy}>
                {categories.map((cat, index) => (
                  <SortableCategoryRow
                    key={cat._id}
                    category={cat}
                    onDelete={handleDeleteCategory}
                    onMoveUp={(id) => moveCategory(id, -1)}
                    onMoveDown={(id) => moveCategory(id, 1)}
                    isFirst={index === 0}
                    isLast={index === categories.length - 1}
                    deleting={deletingCatId === cat._id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            placeholder="Nueva familia..."
            className="flex-1 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
          <Button type="submit" disabled={addingCat || !newCatLabel.trim()} size="sm">
            {addingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </form>
      </section>

      </div>}

      {/* ── TAB: MENÚ ── Configuración del menú público ─────────────── */}
      {activeTab === "menu" && <>

      {/* ── Menú público ────────────────────────────────────────────── */}
      <form onSubmit={handleSaveMenuConfig}>
        <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-6">
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
                  <Button type="button" variant="destructive" size="sm" onClick={handleRemoveMenuBg}>
                    <Trash2 className="w-4 h-4" />
                    Eliminar fondo
                  </Button>
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

      {/* ── TAB: TICKET ── Ticket electrónico ───────────────────────── */}
      {activeTab === "ticket" && <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

      <div className="xl:col-span-3">
      <form onSubmit={handleSaveTicketConfig}>
        <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-brand-dark text-lg">Datos del ticket impreso</h2>
            <p className="text-sm text-brand-dark/50 mt-0.5">
              Esta información aparece en el encabezado y pie de los tickets de venta y de cierre de caja.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-brand-dark mb-1">Nombre del negocio</label>
              <input
                type="text"
                placeholder="Ej: Cafetería Kahve-Tanna"
                value={ticketConfig.businessName}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, businessName: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Ubicación / Sucursal</label>
              <input
                type="text"
                placeholder="Ej: Sucursal Centro"
                value={ticketConfig.location}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Dirección</label>
              <input
                type="text"
                placeholder="Ej: 100m sur de la iglesia"
                value={ticketConfig.address}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Teléfono(s)</label>
              <input
                type="text"
                placeholder="Ej: 2222-3333 / 8888-9999"
                value={ticketConfig.phone}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Correo electrónico</label>
              <input
                type="email"
                placeholder="Ej: contacto@minegocio.com"
                value={ticketConfig.email}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Propietario / Representante</label>
              <input
                type="text"
                placeholder="Ej: Juan Pérez Rodríguez"
                value={ticketConfig.ownerName}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, ownerName: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Cédula</label>
              <input
                type="text"
                placeholder="Ej: 1-2345-6789"
                value={ticketConfig.taxId}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, taxId: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Régimen tributario</label>
              <input
                type="text"
                placeholder="Ej: Régimen Simplificado"
                value={ticketConfig.taxRegime}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, taxRegime: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Número de terminal/caja</label>
              <input
                type="text"
                placeholder="Ej: 1"
                value={ticketConfig.terminalNumber}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, terminalNumber: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Prefijo de ticket</label>
              <input
                type="text"
                placeholder="Ej: A-"
                value={ticketConfig.ticketPrefix}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, ticketPrefix: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-brand-dark mb-1">Mensaje de pie</label>
              <input
                type="text"
                placeholder="Ej: ¡Gracias por su compra!"
                value={ticketConfig.footerMessage}
                onChange={(e) => setTicketConfig((prev) => ({ ...prev, footerMessage: e.target.value }))}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
          </div>

          <Button type="submit" disabled={savingTicket} className="w-full sm:w-auto">
            {savingTicket ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedTicket ? (
              <Check className="w-4 h-4" />
            ) : null}
            {savedTicket ? "¡Guardado!" : "Guardar configuración del ticket"}
          </Button>
        </section>
      </form>

      </div>
      <div className="xl:col-span-2 xl:sticky xl:top-6 space-y-4">

      {/* Previas en vivo */}
      <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-brand-dark text-base">Previa en vivo</h2>
          <p className="text-sm text-brand-dark/50 mt-0.5">
            Así se verán tus tickets con datos de ejemplo.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-brand-dark/60 mb-2 text-center uppercase tracking-wide">Ticket de venta</p>
          <TicketPreview rows={saleTicketRows} />
        </div>
        <div>
          <p className="text-xs font-medium text-brand-dark/60 mb-2 text-center uppercase tracking-wide">Ticket de cierre</p>
          <TicketPreview rows={cashCloseTicketRows} />
        </div>
      </section>

      </div>
      </div>}

      {/* ── TAB: COMANDAS ── Umbrales de tiempo ─────────────────────── */}
      {activeTab === "comandas" && showComandas && <div className="max-w-xl">
        <form onSubmit={handleSaveComandaConfig}>
          <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-brand-dark text-lg">Umbrales de tiempo</h2>
              <p className="text-sm text-brand-dark/50 mt-0.5">
                Definí a partir de cuántos minutos una mesa con comandas activas se marca en amarillo y en rojo.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-brand-dark/60 mb-1">Aviso (amarillo) — minutos</label>
                <input type="number" min={1} max={600} step={1} value={comandaConfig.warnMinutes}
                  onChange={e => setComandaConfig(c => ({ ...c, warnMinutes: Number(e.target.value) }))}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink" />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-dark/60 mb-1">Alerta (rojo) — minutos</label>
                <input type="number" min={1} max={600} step={1} value={comandaConfig.alertMinutes}
                  onChange={e => setComandaConfig(c => ({ ...c, alertMinutes: Number(e.target.value) }))}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink" />
              </div>
            </div>
            <p className="text-xs text-brand-dark/50">
              Verde por debajo del aviso, amarillo entre aviso y alerta, rojo desde la alerta. El badge aparece cuando la mesa tiene comandas activas.
            </p>
            {comandaError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{comandaError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingComanda}>{savingComanda ? "Guardando..." : "Guardar umbrales"}</Button>
              {savedComanda && <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><Check className="w-4 h-4" /> Guardado</span>}
            </div>
          </section>
        </form>
        <div className="mt-6"><PrintQueueSection /></div>
      </div>}

      {/* ── TAB: CAJA ── Cobros del punto de venta + contraseña de eliminación ─ */}
      {activeTab === "caja" && <div className="max-w-xl space-y-6">
        <form onSubmit={handleSavePosCharges}>
          <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-brand-dark text-lg">Cobros del punto de venta</h2>
              <p className="text-sm text-brand-dark/50 mt-0.5">
                Activá los cobros que usa tu negocio. En el punto de venta aparecen con un switch para que el cajero decida si aplican en cada venta; el porcentaje solo se cambia acá.
              </p>
            </div>
            {loadingPosCharges ? (
              <p className="text-sm text-brand-dark/40">Cargando...</p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-dark">Impuesto (IVA)</p>
                    <p className="text-xs text-brand-dark/50">Se cobra en mesa, para llevar y a domicilio.</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100} step={0.5}
                        value={ivaRateInput}
                        disabled={!posCharges.ivaEnabled}
                        onChange={(e) => setIvaRateInput(e.target.value)}
                        aria-label="Porcentaje de impuesto"
                        className="w-16 border border-brand-muted rounded-xl px-2 py-1.5 text-sm text-right focus:outline-none focus:border-brand-pink disabled:opacity-40"
                      />
                      <span className="text-sm text-brand-dark/60">%</span>
                    </div>
                    <Switch label="Cobrar impuesto" checked={posCharges.ivaEnabled} onChange={(v) => setPosCharges((p) => ({ ...p, ivaEnabled: v }))} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-dark">Servicio</p>
                    <p className="text-xs text-brand-dark/50">Solo en pedidos en el local; en retiro y domicilio no se cobra.</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100} step={0.5}
                        value={serviceRateInput}
                        disabled={!posCharges.serviceEnabled}
                        onChange={(e) => setServiceRateInput(e.target.value)}
                        aria-label="Porcentaje de servicio"
                        className="w-16 border border-brand-muted rounded-xl px-2 py-1.5 text-sm text-right focus:outline-none focus:border-brand-pink disabled:opacity-40"
                      />
                      <span className="text-sm text-brand-dark/60">%</span>
                    </div>
                    <Switch label="Cobrar servicio" checked={posCharges.serviceEnabled} onChange={(v) => setPosCharges((p) => ({ ...p, serviceEnabled: v }))} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-dark">Propina</p>
                    <p className="text-xs text-brand-dark/50">Si está activa, el cajero la aplica y escribe el monto en cada venta.</p>
                  </div>
                  <Switch label="Permitir propina" checked={posCharges.tipEnabled} onChange={(v) => setPosCharges((p) => ({ ...p, tipEnabled: v }))} />
                </div>
              </div>
            )}
            {posChargesError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{posChargesError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingPosCharges || loadingPosCharges}>{savingPosCharges ? "Guardando..." : "Guardar cobros"}</Button>
              {savedPosCharges && <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><Check className="w-4 h-4" /> Guardado</span>}
            </div>
          </section>
        </form>

        <form onSubmit={handleSaveSaleDeletePassword}>
          <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-brand-dark text-lg">Contraseña de eliminación de ventas</h2>
              <p className="text-sm text-brand-dark/50 mt-0.5">
                Se pide en Pedidos y ventas para autorizar el borrado de una venta ya registrada.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-brand-dark/50">Estado:</span>
              {loadingSaleDeletePw ? (
                <span className="text-brand-dark/40">Cargando...</span>
              ) : saleDeleteConfigured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                  <Check className="w-3.5 h-3.5" /> Configurada
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 font-medium">Sin configurar</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-brand-dark/60 mb-1">Nueva contraseña</label>
                <input type="password" value={newSaleDeletePw}
                  onChange={(e) => setNewSaleDeletePw(e.target.value)}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink" />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-dark/60 mb-1">Confirmar contraseña</label>
                <input type="password" value={confirmSaleDeletePw}
                  onChange={(e) => setConfirmSaleDeletePw(e.target.value)}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink" />
              </div>
            </div>
            <p className="text-xs text-brand-dark/50">Mínimo 4 caracteres. Viaja por HTTPS; el servidor la guarda cifrada (bcrypt).</p>
            {saleDeletePwError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{saleDeletePwError}</p>}
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="submit" disabled={savingSaleDeletePw}>{savingSaleDeletePw ? "Guardando..." : "Guardar contraseña"}</Button>
              {saleDeleteConfigured && (
                <Button type="button" variant="destructive" disabled={removingSaleDeletePw} onClick={handleRemoveSaleDeletePassword}>
                  {removingSaleDeletePw ? "Quitando..." : "Quitar contraseña"}
                </Button>
              )}
              {savedSaleDeletePw && <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><Check className="w-4 h-4" /> Guardado</span>}
            </div>
          </section>
        </form>
      </div>}

          </div>
        </div>
      </div>
    </div>
  );
}
