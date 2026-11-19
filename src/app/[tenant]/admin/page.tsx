"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatsCard from "@/components/admin/StatsCard";
import GettingStarted from "@/components/admin/GettingStarted";
import { useAdminSession } from "@/components/admin/SessionContext";
import { hrefFor, locationOf, visibleNav } from "@/lib/adminNav";
import {
  TrendingUp, ShoppingBag, Receipt, Clock, Package, Sun, MonitorCheck, ClipboardList, Plus, Palette,
  type LucideIcon,
} from "lucide-react";

/** Accesos de Inicio, en orden: salen los primeros cuatro que el negocio puede usar. */
const QUICK: { label: string; segment: string; tab?: string; tabLabel?: string; icon: LucideIcon }[] = [
  { label: "Cobrar una venta", segment: "pos", icon: MonitorCheck },
  { label: "Ver las comandas", segment: "comandas", icon: ClipboardList },
  { label: "Agregar un producto", segment: "productos", icon: Plus },
  { label: "Registrar un gasto", segment: "gastos", icon: Receipt },
  { label: "Anotar un pedido", segment: "pedidos", icon: ShoppingBag },
  { label: "Cambiar logo y colores", segment: "configuracion", tab: "marca", tabLabel: "Marca", icon: Palette },
];

/** El color con el que se crea un negocio: si sigue ese y no hay logo, todavía no eligió su marca. */
const DEFAULT_PRIMARY = "#6366F1";

const CR = "America/Costa_Rica";

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: CR }).format(now));
  if (hour < 12) return "Buen día";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function todayLabel(now: Date): string {
  const text = new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", timeZone: CR }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface ActivityItem {
  id: string;
  source: "pos" | "manual";
  customerName: string;
  total: number;
  paid: boolean;
  date: string;
}

interface Analytics {
  topClicksThisWeek: { _id: string; productName: string; clicks: number }[];
  recentActivity: ActivityItem[];
  monthStats: {
    totalRevenue: number;
    totalTransactions: number;
    pendingOrders: number;
    todayRevenue: number;
  };
}

export default function AdminDashboard() {
  const session = useAdminSession();
  const [data, setData] = useState<Analytics | null>(null);
  const [productsData, setProductsData] = useState<{ stock?: number; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/analytics").then((r) => r.json()),
      fetch("/api/admin/products").then((r) => r.json()),
    ]).then(([analyticsRes, productsRes]) => {
      setData(analyticsRes);
      setProductsData(productsRes.products ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const slug = session.tenantSlug;
  const base = `/${slug}/admin`;
  const nav = visibleNav(session, base);
  const bySegment = new Map(nav.all.map((i) => [i.segment, i]));
  const quick = QUICK.flatMap((q) => {
    const item = bySegment.get(q.segment);
    return item && !item.lockedPlan
      ? [{ ...q, href: hrefFor(base, q.segment, q.tab), where: locationOf(item, nav.flat, q.tabLabel).join(" › ") }]
      : [];
  }).slice(0, 4);
  const firstName = session.name && session.name !== "Administrador" ? session.name.split(" ")[0] : "";

  const header = (
    <div>
      <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">
        {greeting(now)}{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-brand-dark/60 text-sm mt-1">{todayLabel(now)}. Esto es lo que más vas a usar.</p>
    </div>
  );

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-8">
        {header}
        <div className="text-brand-dark/50 text-sm">Cargando...</div>
      </div>
    );
  }

  const monthStats        = data?.monthStats        ?? { totalRevenue: 0, totalTransactions: 0, pendingOrders: 0, todayRevenue: 0 };
  const topClicksThisWeek = data?.topClicksThisWeek ?? [];
  const recentActivity    = data?.recentActivity    ?? [];

  const totalUnitsInStock = productsData.reduce((s, p) => s + (p.stock ?? 0), 0);
  const estimatedRevenue  = productsData.reduce((s, p) => s + (p.stock ?? 0) * p.price, 0);

  const hasBrand = !!session.logoUrl || (!!session.primaryColor && session.primaryColor.toUpperCase() !== DEFAULT_PRIMARY);
  const saleItem = [bySegment.get("pos"), bySegment.get("pedidos")].find((i) => i && !i.lockedPlan);

  return (
    <div className="p-4 md:p-8 space-y-8">
      {header}

      {quick.length > 0 && (
        <section aria-label="Accesos rápidos" className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {quick.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.href}
                href={q.href}
                className="flex flex-col items-start gap-3 p-4 md:p-5 rounded-2xl bg-white border border-brand-dark/10 hover:border-brand-dark/25 hover:shadow-md transition-all"
              >
                <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--admin-tint)] text-[var(--admin-ink)]">
                  <Icon className="w-5 h-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm md:text-[15px] font-semibold text-brand-dark">{q.label}</span>
                  <span className="block text-xs text-brand-dark/55 mt-0.5">{q.where}</span>
                </span>
              </Link>
            );
          })}
        </section>
      )}

      <GettingStarted
        slug={slug}
        hasBrand={hasBrand}
        hasProducts={productsData.length > 0}
        hasSales={recentActivity.length > 0 || monthStats.totalTransactions > 0}
        brandHref={hrefFor(base, "configuracion", "marca")}
        productsHref={hrefFor(base, "productos")}
        saleHref={saleItem?.href ?? hrefFor(base, "pedidos")}
        saleHint={saleItem ? locationOf(saleItem, nav.flat).join(" › ") : "Pedidos y ventas"}
      />

      {/* mb-3 reemplaza el margen de space-y-8 (Tailwind 4 lo pone abajo de cada bloque): título pegado a sus tarjetas. */}
      <h2 className="font-semibold text-brand-dark mb-3">Este mes</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          label="Ingreso del día"
          value={`₡${monthStats.todayRevenue.toLocaleString("es-CR")}`}
          icon={Sun}
          color="yellow"
          sub="Pedidos + ventas POS de hoy"
        />
        <StatsCard
          label="Ingresos del mes"
          value={`₡${monthStats.totalRevenue.toLocaleString("es-CR")}`}
          icon={TrendingUp}
          color="green"
          sub="Pedidos pagados + ventas POS"
        />
        <StatsCard
          label="Ventas del mes"
          value={monthStats.totalTransactions}
          icon={ShoppingBag}
          color="pink"
          sub="Pedidos + transacciones POS"
        />
        <StatsCard
          label="Pedidos pendientes"
          value={monthStats.pendingOrders}
          icon={Clock}
          color="orange"
          sub="Sin confirmar pago"
        />
      </div>

      {/* Inventario */}
      <div>
        <h2 className="font-semibold text-brand-dark mb-3">Inventario</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatsCard
            label="Unidades en stock"
            value={totalUnitsInStock}
            icon={Package}
            color="pink"
            sub="Total unidades disponibles"
          />
          <StatsCard
            label="Ingresos potenciales"
            value={`₡${estimatedRevenue.toLocaleString("es-CR")}`}
            icon={TrendingUp}
            color="green"
            sub="Si se vende todo el inventario"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos */}
        <div className="bg-white rounded-2xl card-shadow p-6">
          <h2 className="font-semibold text-brand-dark mb-4">
            🔥 Top productos clickeados (esta semana)
          </h2>
          {topClicksThisWeek.length === 0 ? (
            <p className="text-brand-dark/40 text-sm">Sin datos aún. Espera a que los clientes visiten la tienda.</p>
          ) : (
            <div className="space-y-3">
              {topClicksThisWeek.map((p, i) => (
                <div key={p._id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full gradient-bg text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-brand-dark truncate">{p.productName}</span>
                  <span className="text-sm font-semibold text-brand-pink">{p.clicks} clicks</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="bg-white rounded-2xl card-shadow p-6">
          <h2 className="font-semibold text-brand-dark mb-4">📋 Actividad reciente</h2>
          {recentActivity.length === 0 ? (
            <p className="text-brand-dark/40 text-sm">No hay pedidos ni ventas registradas aún.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      item.source === "pos"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-purple-50 text-purple-600"
                    }`}>
                      {item.source === "pos" ? "POS" : "Manual"}
                    </span>
                    <p className="text-sm font-medium text-brand-dark truncate">{item.customerName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-brand-dark">
                      ₡{item.total.toLocaleString("es-CR")}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.paid ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"
                    }`}>
                      {item.paid ? "Pagado" : "Pendiente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
