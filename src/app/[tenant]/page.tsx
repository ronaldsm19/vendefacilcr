export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import HeroSection from "@/components/HeroSection";
import BestSellersSection from "@/components/BestSellersSection";
import ProductsSection from "@/components/ProductsSection";
import TrustSection from "@/components/TrustSection";
import AboutSection from "@/components/AboutSection";
import Footer, { type SocialLinks } from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { headers } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { SiteSettings } from "@/models/SiteSettings";
import { Tenant } from "@/models/Tenant";
import { AccessLog } from "@/models/AccessLog";
import { SeedProduct } from "@/data/seed";

async function getTenant(slug: string) {
  try {
    await connectToDatabase();
    const tenant = await Tenant.findOne({ slug, status: "active" }).lean();
    if (!tenant) return null;
    return JSON.parse(JSON.stringify(tenant)) as {
      _id: string;
      slug: string;
      name: string;
      logoUrl: string;
      whatsappNumber: string;
      instagram: string;
      facebook: string;
      tiktok: string;
      youtube: string;
      theme: {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        backgroundColor?: string;
        logoShape?: string;
        logoBgColor?: string;
        heroImageUrl?: string;
        fontFamily?: string;
        darkMode?: boolean;
      };
    };
  } catch {
    return null;
  }
}

async function getProducts(tenantId: string): Promise<(SeedProduct & { _id?: string })[]> {
  try {
    const products = await Product.find({ tenantId, available: true })
      .sort({ createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(products)) as (SeedProduct & { _id?: string })[];
  } catch {
    return [];
  }
}

async function getSettings(tenantId: string) {
  try {
    const settings = await SiteSettings.findOne({ tenantId }).lean();
    if (!settings) return null;
    return JSON.parse(JSON.stringify(settings)) as {
      hero?: { tagline: string; subtagline: string; badge: string };
      about?: { title: string; paragraph1: string; paragraph2: string; images: string[] };
    };
  } catch {
    return null;
  }
}

export default async function TenantStorefront({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  AccessLog.create({ tenantId: tenant._id, tenantSlug: slug, ip, userAgent: hdrs.get("user-agent") ?? "", success: true, event: "visit", path: `/${slug}` }).catch(() => {});

  const [products, settings] = await Promise.all([
    getProducts(tenant._id),
    getSettings(tenant._id),
  ]);

  const featuredProducts = products.filter(
    (p) => (p as SeedProduct & { featured?: boolean }).featured
  );

  const { primaryColor, secondaryColor, accentColor } = tenant.theme;

  const FONT_MAP: Record<string, string> = {
    default:    "var(--font-inter), system-ui, sans-serif",
    playfair:   "var(--font-playfair), Georgia, serif",
    montserrat: "var(--font-montserrat), system-ui, sans-serif",
    nunito:     "var(--font-nunito), system-ui, sans-serif",
    lato:       "var(--font-lato), system-ui, sans-serif",
  };
  const fontPrimary = FONT_MAP[tenant.theme.fontFamily ?? "default"] ?? FONT_MAP.default;

  const isDark = tenant.theme.darkMode ?? false;
  const colorSurface    = isDark ? "#0F0F1A" : (tenant.theme.backgroundColor ?? "#FFFFFF");
  const colorSurfaceAlt = isDark ? "#1A1A2E" : "#F8F0F5";
  const colorBrandDark  = isDark ? "#E8E8F8" : "#1A1A2E";

  const social: SocialLinks = {
    whatsapp:  tenant.whatsappNumber || undefined,
    instagram: tenant.instagram      || undefined,
    facebook:  tenant.facebook       || undefined,
    tiktok:    tenant.tiktok         || undefined,
    youtube:   tenant.youtube        || undefined,
  };

  return (
    <div
      className="font-primary"
      style={
        {
          "--color-brand-pink":   primaryColor,
          "--color-brand-orange": secondaryColor,
          "--color-brand-yellow": accentColor,
          "--gradient-brand":     `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 50%, ${accentColor} 100%)`,
          "--color-surface":      colorSurface,
          "--color-surface-alt":  colorSurfaceAlt,
          "--color-brand-dark":   colorBrandDark,
          "--font-primary":       fontPrimary,
        } as React.CSSProperties
      }
    >
      <HeroSection
        whatsappNumber={tenant.whatsappNumber}
        heroImageUrl={tenant.theme.heroImageUrl || undefined}
        tenantName={tenant.name}
        logoUrl={tenant.logoUrl || undefined}
        tagline={settings?.hero?.tagline || undefined}
        subtagline={settings?.hero?.subtagline || undefined}
        badge={settings?.hero?.badge || undefined}
      />
      <BestSellersSection products={featuredProducts} whatsappNumber={tenant.whatsappNumber} />
      <ProductsSection products={products} whatsappNumber={tenant.whatsappNumber} />
      <TrustSection />
      <AboutSection aboutData={settings?.about} whatsappNumber={tenant.whatsappNumber} />
      <Footer
        tenantName={tenant.name}
        logoUrl={tenant.logoUrl || undefined}
        logoShape={(tenant.theme.logoShape as "circle" | "rounded" | "square" | "none") ?? "circle"}
        logoBgColor={tenant.theme.logoBgColor || undefined}
        social={social}
      />
      <WhatsAppButton floating whatsappNumber={tenant.whatsappNumber} />
    </div>
  );
}
