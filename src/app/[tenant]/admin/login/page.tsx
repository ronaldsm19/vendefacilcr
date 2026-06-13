import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { AccessLog } from "@/models/AccessLog";
import LoginForm from "./LoginForm";

async function getTenantBranding(slug: string) {
  try {
    await connectToDatabase();
    const tenant = await Tenant.findOne({ slug, status: "active" })
      .select("_id name logoUrl theme")
      .lean();
    if (!tenant) return null;
    return JSON.parse(JSON.stringify(tenant)) as {
      _id: string;
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

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  AccessLog.create({ tenantId: branding._id, tenantSlug: slug, ip, userAgent: hdrs.get("user-agent") ?? "", success: true, event: "visit", path: `/${slug}/admin/login` }).catch(() => {});

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
