import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getSuperadminSession } from "@/lib/auth";
import { ErrorEvent, ERROR_LEVELS, ERROR_SOURCES } from "@/models/ErrorEvent";
import { Tenant } from "@/models/Tenant";

/** Panel de errores del superadmin: resumen, serie por día (u hora) y agrupaciones. */

const PERIODS = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 } as const;
type Period = keyof typeof PERIODS;
const CR_OFFSET_MS = 6 * 3_600_000; // Costa Rica: UTC-6 todo el año
const TZ = "America/Costa_Rica";

const errorsOf = { $sum: { $cond: [{ $eq: ["$level", "error"] }, "$count", 0] } };
const warningsOf = { $sum: { $cond: [{ $eq: ["$level", "aviso"] }, "$count", 0] } };
const tenantCount = { $size: { $setDifference: ["$tenants", [null]] } };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Etiquetas de la serie en hora de Costa Rica, para rellenar los tramos sin errores. */
function seriesLabels(period: Period, now: number): string[] {
  const labels: string[] = [];
  if (period === "24h") {
    const end = Math.floor((now - CR_OFFSET_MS) / 3_600_000) * 3_600_000;
    for (let t = end - 23 * 3_600_000; t <= end; t += 3_600_000) labels.push(new Date(t).toISOString().slice(0, 13) + ":00");
  } else {
    const end = Math.floor((now - CR_OFFSET_MS) / 86_400_000) * 86_400_000;
    for (let t = end - (PERIODS[period] - 1) * 86_400_000; t <= end; t += 86_400_000) labels.push(new Date(t).toISOString().slice(0, 10));
  }
  return labels;
}

export async function GET(request: NextRequest) {
  const session = await getSuperadminSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const period: Period = (sp.get("periodo") as Period) in PERIODS ? sp.get("periodo") as Period : "7d";
  const now = Date.now();
  const since = new Date(now - PERIODS[period] * 86_400_000);

  const match: Record<string, unknown> = { bucket: { $gte: since } };
  const tenant = sp.get("negocio");
  if (tenant === "ninguno") match.tenantId = null;
  else if (tenant && mongoose.isValidObjectId(tenant)) match.tenantId = new mongoose.Types.ObjectId(tenant);
  const level = sp.get("nivel");
  if (level && (ERROR_LEVELS as string[]).includes(level)) match.level = level;
  const source = sp.get("origen");
  if (source && (ERROR_SOURCES as string[]).includes(source)) match.source = source;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    match.$or = [{ message: re }, { route: re }, { page: re }];
  }

  await connectToDatabase();
  const [facets] = await ErrorEvent.aggregate([
    { $match: match },
    { $facet: {
      totals: [{ $group: { _id: null, errores: errorsOf, avisos: warningsOf } }],
      tenants: [{ $match: { tenantId: { $ne: null } } }, { $group: { _id: "$tenantId" } }, { $count: "n" }],
      lastError: [{ $match: { level: "error" } }, { $sort: { lastAt: -1 } }, { $limit: 1 }, { $project: { lastAt: 1, message: 1, route: 1 } }],
      series: [{ $group: {
        _id: { $dateToString: { format: period === "24h" ? "%Y-%m-%dT%H:00" : "%Y-%m-%d", date: "$bucket", timezone: TZ } },
        errores: errorsOf, avisos: warningsOf,
      } }],
      byApi: [
        { $sort: { count: -1 } },
        { $group: {
          _id: { method: "$method", route: "$route", source: "$source" },
          errores: errorsOf, avisos: warningsOf, tenants: { $addToSet: "$tenantId" },
          ultimo: { $max: "$lastAt" }, mensaje: { $first: "$message" },
        } },
        { $addFields: { negocios: tenantCount } },
        { $sort: { errores: -1, avisos: -1 } },
        { $limit: 50 },
        { $project: { tenants: 0 } },
      ],
      byTenant: [
        { $group: {
          _id: { tenantId: "$tenantId", method: "$method", route: "$route" },
          tenantSlug: { $first: "$tenantSlug" }, errores: errorsOf, avisos: warningsOf, ultimo: { $max: "$lastAt" },
        } },
        { $sort: { errores: -1, avisos: -1 } },
        { $group: {
          _id: "$_id.tenantId", tenantSlug: { $first: "$tenantSlug" },
          errores: { $sum: "$errores" }, avisos: { $sum: "$avisos" }, ultimo: { $max: "$ultimo" },
          apiTop: { $first: { method: "$_id.method", route: "$_id.route" } },
        } },
        { $sort: { errores: -1, avisos: -1 } },
        { $limit: 100 },
      ],
      messages: [
        { $group: {
          _id: { message: "$message", route: "$route", level: "$level" },
          veces: { $sum: "$count" }, tenants: { $addToSet: "$tenantId" }, ultimo: { $max: "$lastAt" },
        } },
        { $addFields: { negocios: tenantCount } },
        { $sort: { veces: -1 } },
        { $limit: 50 },
        { $project: { tenants: 0 } },
      ],
      latest: [
        { $sort: { lastAt: -1 } },
        { $limit: 100 },
        { $project: { fingerprint: 0, bucket: 0, firstSeen: 0 } },
      ],
    } },
  ]);

  // Nombres de los negocios que aparecen, más la lista completa para el filtro.
  const allTenants = await Tenant.find({}).select("name slug").sort({ name: 1 }).lean() as { _id: unknown; name: string; slug: string }[];
  const names = Object.fromEntries(allTenants.map((t) => [String(t._id), { name: t.name || t.slug, slug: t.slug }]));

  const bySeries = new Map<string, { errores: number; avisos: number }>(
    facets.series.map((s: { _id: string; errores: number; avisos: number }) => [s._id, { errores: s.errores, avisos: s.avisos }]),
  );
  const totals = facets.totals[0] ?? { errores: 0, avisos: 0 };

  return NextResponse.json({
    periodo: period,
    resumen: {
      errores: totals.errores,
      avisos: totals.avisos,
      negocios: facets.tenants[0]?.n ?? 0,
      ultimoError: facets.lastError[0] ?? null,
    },
    serie: seriesLabels(period, now).map((label) => ({ label, ...(bySeries.get(label) ?? { errores: 0, avisos: 0 }) })),
    porApi: facets.byApi,
    porNegocio: facets.byTenant,
    mensajes: facets.messages,
    ultimos: facets.latest,
    negocios: names,
    listaNegocios: allTenants.map((t) => ({ _id: String(t._id), name: t.name || t.slug, slug: t.slug })),
  });
}
