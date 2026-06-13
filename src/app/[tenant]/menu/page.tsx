export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { Tenant } from "@/models/Tenant";
import { AccessLog } from "@/models/AccessLog";

async function getTenantWithMenu(slug: string) {
  try {
    await connectToDatabase();
    const tenant = await Tenant.findOne({ slug, status: "active" }).lean();
    if (!tenant) return null;
    return JSON.parse(JSON.stringify(tenant)) as {
      _id: string;
      slug: string;
      name: string;
      logoUrl: string;
      theme: {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        backgroundColor?: string;
        fontFamily?: string;
        darkMode?: boolean;
      };
      menuConfig?: {
        columns: 1 | 2 | 3;
        showImage: boolean;
        showPrice: boolean;
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        bgImageUrl?: string;
        bgBlur?: number;
        title?: string;
        description?: string;
        fontFamily?: string;
      };
    };
  } catch {
    return null;
  }
}

async function getAvailableProducts(tenantId: string) {
  try {
    const products = await Product.find({ tenantId, available: true })
      .sort({ createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(products)) as Array<{
      _id: string;
      name: string;
      price: number;
      image?: string;
      menuSection?: string;
    }>;
  } catch {
    return [];
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ElegantPlaceholder({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div
      className="w-full aspect-[4/3] flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${primary}22, ${secondary}33)` }}
    >
      <span className="text-5xl opacity-20 select-none">🍽</span>
    </div>
  );
}

/** Card premium para grilla de 2–3 columnas */
function PremiumCard({
  product, primary, secondary, showImage, showPrice, isFirst,
}: {
  product: { _id: string; name: string; price: number; image?: string };
  primary: string;
  secondary: string;
  showImage: boolean;
  showPrice: boolean;
  isFirst: boolean;
}) {
  return (
    <article className="group rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white flex flex-col">
      {showImage && (
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          {product.image ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                loading={isFirst ? "eager" : "lazy"}
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {/* Gradiente inferior para contraste */}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </>
          ) : (
            <ElegantPlaceholder primary={primary} secondary={secondary} />
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2 p-4">
        <h2 className="font-bold text-base leading-snug text-gray-900 flex-1">{product.name}</h2>
        {showPrice && (
          <span
            className="text-sm font-bold whitespace-nowrap px-3 py-1 rounded-full flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: "#fff" }}
          >
            ₡{product.price.toLocaleString("es-CR")}
          </span>
        )}
      </div>
    </article>
  );
}

/** Fila de lista compacta para columna-1 (Panadería) */
function ListRow({
  product, primary, secondary, showImage, showPrice, isFirst,
}: {
  product: { _id: string; name: string; price: number; image?: string };
  primary: string;
  secondary: string;
  showImage: boolean;
  showPrice: boolean;
  isFirst: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-current/10 last:border-0">
      {showImage && (
        <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              loading={isFirst ? "eager" : "lazy"}
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-xl"
              style={{ background: `linear-gradient(135deg, ${primary}22, ${secondary}33)` }}
            >
              <span className="opacity-30">🍽</span>
            </div>
          )}
        </div>
      )}
      <span className="font-medium text-sm flex-1 leading-snug">{product.name}</span>
      {/* Dotted fill */}
      <span className="flex-1 border-b border-dotted border-current opacity-25 self-center hidden sm:block" />
      {showPrice && (
        <span
          className="text-sm font-bold whitespace-nowrap px-2.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: "#fff" }}
        >
          ₡{product.price.toLocaleString("es-CR")}
        </span>
      )}
    </div>
  );
}

/** Fila de lista estilo carta oscura para Bebidas */
function DrinkRow({
  product, primary, secondary, showImage, showPrice, isFirst,
}: {
  product: { _id: string; name: string; price: number; image?: string };
  primary: string;
  secondary: string;
  showImage: boolean;
  showPrice: boolean;
  isFirst: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0">
      {showImage && (
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              loading={isFirst ? "eager" : "lazy"}
              className="object-cover opacity-90"
              sizes="48px"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-lg"
              style={{ background: `linear-gradient(135deg, ${primary}44, ${secondary}44)` }}
            >
              <span className="opacity-40">☕</span>
            </div>
          )}
        </div>
      )}
      <span className="font-medium text-sm flex-1 leading-snug text-slate-100">{product.name}</span>
      {/* Dotted fill */}
      <span className="flex-1 border-b border-dotted border-white/20 self-center hidden sm:block" />
      {showPrice && (
        <span className="text-sm font-bold whitespace-nowrap text-slate-200 flex-shrink-0">
          ₡{product.price.toLocaleString("es-CR")}
        </span>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS_GRID: Record<2 | 3, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

const FONT_MAP: Record<string, string> = {
  default:    "var(--font-inter), system-ui, sans-serif",
  playfair:   "var(--font-playfair), Georgia, serif",
  montserrat: "var(--font-montserrat), system-ui, sans-serif",
  nunito:     "var(--font-nunito), system-ui, sans-serif",
  lato:       "var(--font-lato), system-ui, sans-serif",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tenant: slug }, { tab: tabParam }] = await Promise.all([params, searchParams]);

  const tenant = await getTenantWithMenu(slug);
  if (!tenant) notFound();

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  AccessLog.create({ tenantId: tenant._id, tenantSlug: slug, ip, userAgent: hdrs.get("user-agent") ?? "", success: true, event: "visit", path: `/${slug}/menu` }).catch(() => {});

  const allProducts = await getAvailableProducts(tenant._id);

  const panaderiaProducts = allProducts.filter((p) => p.menuSection !== "bebidas");
  const bebidasProducts   = allProducts.filter((p) => p.menuSection === "bebidas");

  const hasPanaderia = panaderiaProducts.length > 0;
  const hasBebidas   = bebidasProducts.length > 0;
  const showTabs     = hasPanaderia && hasBebidas;

  // Determinar tab activa (caer al disponible si la pedida está vacía)
  let activeTab = tabParam === "bebidas" ? "bebidas" : "panaderia";
  if (activeTab === "panaderia" && !hasPanaderia) activeTab = "bebidas";
  if (activeTab === "bebidas"   && !hasBebidas)   activeTab = "panaderia";

  const currentProducts = activeTab === "bebidas" ? bebidasProducts : panaderiaProducts;

  // Colores y apariencia
  const primary   = tenant.menuConfig?.primaryColor   || tenant.theme.primaryColor;
  const secondary = tenant.menuConfig?.secondaryColor || tenant.theme.secondaryColor;
  const accent    = tenant.menuConfig?.accentColor    || tenant.theme.accentColor;

  const isDark       = tenant.theme.darkMode ?? false;
  const colorSurface = isDark ? "#0F0F1A" : (tenant.theme.backgroundColor ?? "#FFFFFF");
  const colorText    = isDark ? "#E8E8F8" : "#1A1A2E";
  const fontPrimary  = FONT_MAP[tenant.menuConfig?.fontFamily ?? tenant.theme.fontFamily ?? "default"] ?? FONT_MAP.default;

  const menuTitle       = tenant.menuConfig?.title       ?? "";
  const menuDescription = tenant.menuConfig?.description ?? "";
  const columns         = (tenant.menuConfig?.columns ?? 2) as 1 | 2 | 3;
  const showImage       = tenant.menuConfig?.showImage ?? true;
  const showPrice       = tenant.menuConfig?.showPrice ?? true;
  const bgImageUrl      = tenant.menuConfig?.bgImageUrl ?? "";
  const bgBlurPx        = Math.round(((tenant.menuConfig?.bgBlur ?? 0) / 100) * 30);

  return (
    <div
      className="relative"
      style={
        {
          "--color-brand-pink":   primary,
          "--color-brand-orange": secondary,
          "--color-brand-yellow": accent,
          "--gradient-brand":     `linear-gradient(135deg, ${primary} 0%, ${secondary} 50%, ${accent} 100%)`,
          "--color-surface":      colorSurface,
          "--color-brand-dark":   colorText,
          "--font-primary":       fontPrimary,
          backgroundColor:        colorSurface,
          color:                  colorText,
          fontFamily:             fontPrimary,
          minHeight:              "100vh",
        } as React.CSSProperties
      }
    >
      {/* Fondo con blur */}
      {bgImageUrl && (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:    `url(${bgImageUrl})`,
              backgroundSize:     "cover",
              backgroundPosition: "center",
              filter:             bgBlurPx > 0 ? `blur(${bgBlurPx}px)` : undefined,
              transform:          bgBlurPx > 0 ? "scale(1.08)" : undefined,
            }}
          />
        </div>
      )}

      <div className="relative z-10" style={{ minHeight: "100vh" }}>
        {/* ── Header ── */}
        <header
          className="sticky top-0 z-20 border-b"
          style={{
            backgroundColor: bgImageUrl ? "transparent" : colorSurface,
            borderColor:     isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            backdropFilter:  "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {tenant.logoUrl && (
                <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                  <Image src={tenant.logoUrl} alt={tenant.name} fill className="object-cover" sizes="40px" />
                </div>
              )}
              <h1 className="font-bold text-lg leading-tight">{tenant.name}</h1>
            </div>
            <Link href={`/${slug}`} className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity whitespace-nowrap">
              Ver tienda →
            </Link>
          </div>
        </header>

        {/* ── Título y descripción ── */}
        {(menuTitle || menuDescription) && (
          <div className="max-w-5xl mx-auto px-4 pt-8 pb-2 text-center">
            {menuTitle && (
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: primary }}>
                {menuTitle}
              </h2>
            )}
            {menuDescription && (
              <p className="mt-2 text-base opacity-70 max-w-xl mx-auto leading-relaxed">
                {menuDescription}
              </p>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        {showTabs && (
          <div className="max-w-5xl mx-auto px-4 pt-6 pb-0">
            <div
              className="inline-flex rounded-2xl p-1 gap-1"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}
            >
              {(["panaderia", "bebidas"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Link
                    key={tab}
                    href={`?tab=${tab}`}
                    className="px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={
                      isActive
                        ? { background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }
                        : { color: colorText, opacity: 0.6 }
                    }
                  >
                    {tab === "panaderia" ? "🥐 Panadería" : "☕ Bebidas"}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Contenido ── */}
        <main className="max-w-5xl mx-auto px-4 py-6">
          {currentProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
              <span className="text-6xl">🛒</span>
              <p className="text-base font-medium">No hay productos disponibles</p>
            </div>
          ) : activeTab === "bebidas" ? (
            /* ── Tab Bebidas: carta oscura ── */
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg, #1e293b, #0f172a)" }}>
              <div className="p-6 sm:p-8">
                <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase mb-5">
                  {menuTitle || tenant.name}
                </p>
                <div>
                  {bebidasProducts.map((product, idx) => (
                    <DrinkRow
                      key={product._id}
                      product={product}
                      primary={primary}
                      secondary={secondary}
                      showImage={showImage}
                      showPrice={showPrice}
                      isFirst={idx === 0}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : columns === 1 ? (
            /* ── Panadería: lista compacta ── */
            <div
              className="rounded-2xl px-4 sm:px-6"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }}
            >
              {panaderiaProducts.map((product, idx) => (
                <ListRow
                  key={product._id}
                  product={product}
                  primary={primary}
                  secondary={secondary}
                  showImage={showImage}
                  showPrice={showPrice}
                  isFirst={idx === 0}
                />
              ))}
            </div>
          ) : (
            /* ── Panadería: grilla de cards premium ── */
            <div className={`grid gap-5 ${COLS_GRID[columns as 2 | 3]}`}>
              {panaderiaProducts.map((product, idx) => (
                <PremiumCard
                  key={product._id}
                  product={product}
                  primary={primary}
                  secondary={secondary}
                  showImage={showImage}
                  showPrice={showPrice}
                  isFirst={idx === 0}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
