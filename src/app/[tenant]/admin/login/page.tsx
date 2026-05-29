import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import LoginForm from "./LoginForm";

async function getTenantBranding(slug: string) {
  try {
    await connectToDatabase();
    const tenant = await Tenant.findOne({ slug, status: "active" })
      .select("name logoUrl theme")
      .lean();
    if (!tenant) return null;
    return JSON.parse(JSON.stringify(tenant)) as {
      name: string;
      logoUrl?: string;
      theme?: { primaryColor?: string; secondaryColor?: string };
    };
  } catch {
    return null;
  }
}

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const branding = await getTenantBranding(slug);
  if (!branding) notFound();

  return (
    <LoginForm
      slug={slug}
      tenantName={branding.name}
      logoUrl={branding.logoUrl || undefined}
      primaryColor={branding.theme?.primaryColor || "#6366F1"}
      secondaryColor={branding.theme?.secondaryColor || "#8B5CF6"}
    />
  );
}
