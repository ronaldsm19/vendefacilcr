export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import HeroSection from "@/components/HeroSection";
import BestSellersSection from "@/components/BestSellersSection";
import ProductsSection from "@/components/ProductsSection";
import TrustSection from "@/components/TrustSection";
import AboutSection from "@/components/AboutSection";
import Footer, { type SocialLinks } from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { SiteSettings } from "@/models/SiteSettings";
import { Tenant } from "@/models/Tenant";
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
      theme: { primaryColor: string; secondaryColor: string; accentColor: string };
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

  const [products, settings] = await Promise.all([
    getProducts(tenant._id),
    getSettings(tenant._id),
  ]);

  const featuredProducts = products.filter(
    (p) => (p as SeedProduct & { featured?: boolean }).featured
  );

  const { primaryColor, secondaryColor, accentColor } = tenant.theme;

  const social: SocialLinks = {
    whatsapp:  tenant.whatsappNumber || undefined,
    instagram: tenant.instagram      || undefined,
    facebook:  tenant.facebook       || undefined,
    tiktok:    tenant.tiktok         || undefined,
    youtube:   tenant.youtube        || undefined,
  };

  return (
    <div
      style={
        {
          "--color-brand-pink":   primaryColor,
          "--color-brand-orange": secondaryColor,
          "--color-brand-yellow": accentColor,
          "--gradient-brand": `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 50%, ${accentColor} 100%)`,
        } as React.CSSProperties
      }
    >
      <HeroSection />
      <BestSellersSection products={featuredProducts} />
      <ProductsSection products={products} />
      <TrustSection />
      <AboutSection aboutData={settings?.about} />
      <Footer tenantName={tenant.name} logoUrl={tenant.logoUrl || undefined} social={social} />
      <WhatsAppButton floating whatsappNumber={tenant.whatsappNumber} />
    </div>
  );
}
