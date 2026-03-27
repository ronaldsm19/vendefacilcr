"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import StatsCard from "@/components/admin/StatsCard";
import { TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";

interface FinanceData {
  summary: { revenue: number; expenses: number; profit: number; margin: number; totalOrders: number };
  revenueByPeriod: { _id: string; revenue: number; orders: number }[];
  expensesByPeriod: { _id: string; expenses: number }[];
  revenueByProduct: { _id: string; revenue: number; orders: number }[];
  expensesByCategory: { _id: string; total: number; count: number }[];
}

const PIE_COLORS = ["#FF6B9D", "#FF8C42", "#FFD166", "#6B8CFF", "#7ED4AD"];

const catLabel: Record<string, string> = {
  materia_prima: "Materia prima",
  empaque: "Empaque",
  herramientas: "Herramientas",
  marketing: "Marketing",
  otros: "Otros",
};

interface RechartsTooltipProps {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-brand-muted rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-brand-dark mb-1">{label}</p>
      {payload.map((p: { name?: string; value?: number; color?: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: ₡{Number(p.value).toLocaleString("es-CR")}
        </p>
      ))}
    </div>
  );
}

export default function AdminFinancesPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/finances?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [period]);

  // Merge revenue + expense by period key for bar chart
  const chartData = (() => {
    if (!data) return [];
    const map: Record<string, { period: string; Ingresos: number; Gastos: number }> = {};
    data.revenueByPeriod.forEach((r) => {
      map[r._id] = { period: r._id, Ingresos: r.revenue, Gastos: 0 };
    });
    data.expensesByPeriod.forEach((e) => {
      if (!map[e._id]) map[e._id] = { period: e._id, Ingresos: 0, Gastos: 0 };
      map[e._id].Gastos = e.expenses;
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  })();

  const pieData = data?.expensesByCategory.map((c) => ({
    name: catLabel[c._id] ?? c._id,
    value: c.total,
  })) ?? [];

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Finanzas</h1>
          <p className="text-brand-dark/50 text-sm mt-1">Análisis de ingresos y gastos</p>
        </div>
        <div className="flex gap-2">
          {(["week", "month", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
                period === p
                  ? "gradient-bg text-white border-transparent"
                  : "bg-white text-brand-dark/60 border-brand-muted hover:border-brand-pink/30"
              }`}
            >
              {p === "week" ? "Semanas" : p === "month" ? "Meses" : "Año"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando datos financieros...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard
              label="Ingresos totales"
              value={`₡${(data?.summary.revenue ?? 0).toLocaleString("es-CR")}`}
              icon={TrendingUp}
              color="green"
            />
            <StatsCard
              label="Gastos totales"
              value={`₡${(data?.summary.expenses ?? 0).toLocaleString("es-CR")}`}
              icon={TrendingDown}
              color="orange"
            />
            <StatsCard
              label="Ganancia neta"
              value={`₡${(data?.summary.profit ?? 0).toLocaleString("es-CR")}`}
              icon={DollarSign}
              color={(data?.summary.profit ?? 0) >= 0 ? "green" : "orange"}
            />
            <StatsCard
              label="Margen de ganancia"
              value={`${data?.summary.margin ?? 0}%`}
              icon={Percent}
              color="yellow"
              sub={`${data?.summary.totalOrders ?? 0} pedidos pagados`}
            />
          </div>

          {/* Main bar chart */}
          <div className="bg-white rounded-2xl card-shadow p-6">
            <h2 className="font-semibold text-brand-dark mb-6">Ingresos vs Gastos</h2>
            {chartData.length === 0 ? (
              <p className="text-brand-dark/40 text-sm text-center py-8">Sin datos para el período seleccionado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F8F0F5" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#1A1A2E80" }} />
                  <YAxis tickFormatter={(v) => `₡${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#1A1A2E80" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Ingresos" fill="#25D366" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Gastos" fill="#FF6B9D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by product */}
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="font-semibold text-brand-dark mb-4">💰 Ingresos por producto</h2>
              {(data?.revenueByProduct ?? []).length === 0 ? (
                <p className="text-brand-dark/40 text-sm">Sin datos.</p>
              ) : (
                <div className="space-y-3">
                  {data?.revenueByProduct.map((p, i) => {
                    const maxRevenue = data.revenueByProduct[0].revenue;
                    const pct = Math.round((p.revenue / maxRevenue) * 100);
                    return (
                      <div key={p._id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-brand-dark font-medium truncate max-w-[60%]">{p._id}</span>
                          <span className="text-brand-dark/60 shrink-0 ml-2">
                            ₡{p.revenue.toLocaleString("es-CR")} · {p.orders} pedidos
                          </span>
                        </div>
                        <div className="h-2 bg-brand-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: `${PIE_COLORS[i % PIE_COLORS.length]}`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Expenses by category pie */}
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="font-semibold text-brand-dark mb-4">📊 Gastos por categoría</h2>
              {pieData.length === 0 ? (
                <p className="text-brand-dark/40 text-sm">Sin gastos registrados.</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-1/2 shrink-0">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                          dataKey="value" stroke="none">
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    {pieData.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-brand-dark/70 flex-1 truncate">{item.name}</span>
                        <span className="font-semibold text-brand-dark shrink-0">
                          ₡{item.value.toLocaleString("es-CR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line chart - revenue trend */}
          {chartData.length > 1 && (
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="font-semibold text-brand-dark mb-6">Tendencia de ingresos</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F8F0F5" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#1A1A2E80" }} />
                  <YAxis tickFormatter={(v) => `₡${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#1A1A2E80" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Ingresos" stroke="#25D366" strokeWidth={2.5} dot={{ fill: "#25D366", r: 4 }} />
                  <Line type="monotone" dataKey="Gastos" stroke="#FF6B9D" strokeWidth={2.5} strokeDasharray="5 4" dot={{ fill: "#FF6B9D", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
