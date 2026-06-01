"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Printer, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleRow {
  _id: string;
  cashUserName: string;
  paymentMethod: "efectivo" | "sinpe" | "tarjeta" | "mixto";
  mixedPayment?: { efectivo: number; sinpe: number; tarjeta: number };
  total: number;
  saleDate: string;
}

interface ProductSummary {
  productId: string;
  productName: string;
  unitsSold: number;
}

interface TodayData {
  sales: SaleRow[];
  salesTotal: number;
  paymentBreakdown: { efectivo: number; sinpe: number; tarjeta: number };
  expensesTotal: number;
  profit: number;
  productsSummary: ProductSummary[];
  date: string;
}

interface CashCloseRow {
  _id: string;
  closeDate: string;
  closedBy: string;
  salesTotal: number;
  expensesTotal: number;
  profit: number;
  paymentBreakdown: { efectivo: number; sinpe: number; tarjeta: number };
  arqueo?: { totalContado: number; totalEsperado: number; diferencia: number };
}

const DENOMS = [
  { valor: 5,     label: "₡5",       tipo: "moneda" },
  { valor: 10,    label: "₡10",      tipo: "moneda" },
  { valor: 25,    label: "₡25",      tipo: "moneda" },
  { valor: 50,    label: "₡50",      tipo: "moneda" },
  { valor: 100,   label: "₡100",     tipo: "moneda" },
  { valor: 500,   label: "₡500",     tipo: "moneda" },
  { valor: 1000,  label: "₡1.000",   tipo: "billete" },
  { valor: 2000,  label: "₡2.000",   tipo: "billete" },
  { valor: 5000,  label: "₡5.000",   tipo: "billete" },
  { valor: 10000, label: "₡10.000",  tipo: "billete" },
  { valor: 20000, label: "₡20.000",  tipo: "billete" },
  { valor: 50000, label: "₡50.000",  tipo: "billete" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", { day: "2-digit", month: "long", year: "numeric" });
}

const METHOD_LABELS: Record<string, string> = {
  efectivo: "💵 Efectivo",
  sinpe:    "📱 SINPE",
  tarjeta:  "💳 Tarjeta",
  mixto:    "🔀 Mixto",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CierreDeCajaPage() {
  const [today, setToday]         = useState<TodayData | null>(null);
  const [closes, setCloses]       = useState<CashCloseRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [closing, setClosing]     = useState(false);
  const [closedToday, setClosedToday] = useState(false);
  const [counts, setCounts]       = useState<Record<number, number>>(
    Object.fromEntries(DENOMS.map((d) => [d.valor, 0]))
  );

  const loadData = useCallback(async () => {
    const [todayRes, closesRes] = await Promise.all([
      fetch("/api/admin/cash-close/today").then((r) => r.json()),
      fetch("/api/admin/cash-close").then((r) => r.json()),
    ]);
    setToday(todayRes);
    const allCloses: CashCloseRow[] = closesRes.closes ?? [];
    setCloses(allCloses);
    // Verificar si ya se cerró hoy
    const todayStr = new Date().toDateString();
    setClosedToday(allCloses.some((c) => new Date(c.closeDate).toDateString() === todayStr));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleClose() {
    if (!today) return;
    setClosing(true);
    try {
      const efectivoEsperado = today.paymentBreakdown.efectivo;
      const totalContado = DENOMS.reduce((s, d) => s + d.valor * (counts[d.valor] ?? 0), 0);
      const diferencia = totalContado - efectivoEsperado;
      const denominaciones = DENOMS
        .filter((d) => (counts[d.valor] ?? 0) > 0)
        .map((d) => ({ valor: d.valor, cantidad: counts[d.valor], subtotal: d.valor * counts[d.valor] }));

      await fetch("/api/admin/cash-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closeDate:        new Date().toISOString(),
          salesTotal:       today.salesTotal,
          paymentBreakdown: today.paymentBreakdown,
          expensesTotal:    today.expensesTotal,
          profit:           today.profit,
          productsSummary:  today.productsSummary,
          arqueo: {
            denominaciones,
            totalContado,
            totalEsperado: efectivoEsperado,
            diferencia,
          },
        }),
      });
      await loadData();
    } finally {
      setClosing(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: fixed; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 no-print">
          <h1 className="font-brand text-2xl font-bold text-brand-dark">Cierre de caja</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-xl border border-brand-muted text-brand-dark/50 hover:text-brand-dark hover:bg-brand-muted/20 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button variant="secondary" onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </Button>
            <Button
              onClick={handleClose}
              disabled={closing || closedToday || !today?.sales.length}
              className="gap-2"
            >
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : closedToday ? <Check className="w-4 h-4" /> : null}
              {closedToday ? "Caja cerrada hoy" : "Cerrar el día"}
            </Button>
          </div>
        </div>

        {/* Print area */}
        <div id="print-area" className="space-y-5">
          {/* Print header (only shown when printing) */}
          <div className="hidden print:block text-center mb-4">
            <p className="font-bold text-lg">Reporte de cierre de caja</p>
            <p className="text-sm text-gray-500">{today?.date ? fmtDate(today.date) : ""}</p>
          </div>

          {/* Resumen del día */}
          <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
            <h2 className="font-semibold text-brand-dark text-lg">
              Hoy — {today?.date ? fmtDate(today.date) : ""}
              {today?.sales.length === 0 && (
                <span className="ml-2 text-sm font-normal text-brand-dark/40">Sin ventas registradas</span>
              )}
            </h2>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Ventas totales", value: fmt(today?.salesTotal ?? 0), color: "text-emerald-600" },
                { label: "Gastos del día",  value: fmt(today?.expensesTotal ?? 0), color: "text-red-500" },
                { label: "Ganancia neta",   value: fmt(today?.profit ?? 0), color: (today?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500" },
                { label: "Facturas",        value: String(today?.sales.length ?? 0), color: "text-brand-pink" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-brand-dark/50 mb-1">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Desglose por método */}
            <div>
              <p className="text-sm font-medium text-brand-dark mb-2">Desglose por método de pago</p>
              <div className="grid grid-cols-3 gap-3">
                {(["efectivo", "sinpe", "tarjeta"] as const).map((m) => (
                  <div key={m} className="rounded-xl border border-brand-muted p-3 text-center">
                    <p className="text-xs text-brand-dark/50 mb-1">{METHOD_LABELS[m]}</p>
                    <p className="font-bold text-brand-dark">{fmt(today?.paymentBreakdown[m] ?? 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Arqueo de caja ── */}
          {(() => {
            const totalContado = DENOMS.reduce((s, d) => s + d.valor * (counts[d.valor] ?? 0), 0);
            const efectivoEsperado = today?.paymentBreakdown.efectivo ?? 0;
            const diferencia = totalContado - efectivoEsperado;
            const monedas  = DENOMS.filter((d) => d.tipo === "moneda");
            const billetes = DENOMS.filter((d) => d.tipo === "billete");

            return (
              <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4 no-print">
                <h2 className="font-semibold text-brand-dark text-lg">Arqueo de caja</h2>
                <p className="text-xs text-brand-dark/50">Contá el dinero físico en caja e ingresá la cantidad de cada denominación.</p>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-muted text-brand-dark/50 text-xs">
                      <th className="text-left py-2 font-medium">Denominación</th>
                      <th className="text-center py-2 font-medium w-28">Cantidad</th>
                      <th className="text-right py-2 font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={3} className="py-1.5 text-xs font-semibold text-brand-dark/40 uppercase tracking-wider">Monedas</td></tr>
                    {monedas.map((d) => (
                      <tr key={d.valor} className="border-b border-gray-50">
                        <td className="py-1.5 text-brand-dark font-medium">{d.label}</td>
                        <td className="py-1.5 text-center">
                          <input
                            type="number" min={0} step={1}
                            value={counts[d.valor] || ""}
                            placeholder="0"
                            onChange={(e) => setCounts((prev) => ({ ...prev, [d.valor]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-20 text-center border border-brand-muted rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-brand-pink"
                          />
                        </td>
                        <td className="py-1.5 text-right font-mono text-brand-dark/70">
                          {d.valor * (counts[d.valor] ?? 0) > 0 ? fmt(d.valor * (counts[d.valor] ?? 0)) : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr><td colSpan={3} className="pt-3 pb-1.5 text-xs font-semibold text-brand-dark/40 uppercase tracking-wider">Billetes</td></tr>
                    {billetes.map((d) => (
                      <tr key={d.valor} className="border-b border-gray-50">
                        <td className="py-1.5 text-brand-dark font-medium">{d.label}</td>
                        <td className="py-1.5 text-center">
                          <input
                            type="number" min={0} step={1}
                            value={counts[d.valor] || ""}
                            placeholder="0"
                            onChange={(e) => setCounts((prev) => ({ ...prev, [d.valor]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-20 text-center border border-brand-muted rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-brand-pink"
                          />
                        </td>
                        <td className="py-1.5 text-right font-mono text-brand-dark/70">
                          {d.valor * (counts[d.valor] ?? 0) > 0 ? fmt(d.valor * (counts[d.valor] ?? 0)) : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-brand-muted">
                      <td colSpan={2} className="pt-2 text-sm font-bold text-brand-dark">Total contado</td>
                      <td className="pt-2 text-right font-bold text-lg text-brand-dark">{fmt(totalContado)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Banner de comparación */}
                {totalContado > 0 && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                    diferencia === 0
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      : diferencia < 0
                      ? "bg-red-50 border border-red-200 text-red-700"
                      : "bg-amber-50 border border-amber-200 text-amber-700"
                  }`}>
                    {diferencia === 0 && "✓ Cuadra perfectamente — el efectivo en caja coincide con las ventas."}
                    {diferencia < 0 && `⚠ Faltan ${fmt(Math.abs(diferencia))}: tenés ${fmt(efectivoEsperado)} en ventas en efectivo y ${fmt(totalContado)} en caja.`}
                    {diferencia > 0 && `ℹ Sobran ${fmt(diferencia)} en caja — contás ${fmt(totalContado)} pero las ventas en efectivo suman ${fmt(efectivoEsperado)}.`}
                  </div>
                )}
              </section>
            );
          })()}

          {/* Listado de ventas del día */}
          {(today?.sales.length ?? 0) > 0 && (
            <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-3">
              <h2 className="font-semibold text-brand-dark text-lg">Ventas del día</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-muted text-brand-dark/50 text-xs">
                      <th className="text-left py-2 pr-3 font-medium">Hora</th>
                      <th className="text-left py-2 pr-3 font-medium">Encargado</th>
                      <th className="text-left py-2 pr-3 font-medium">Método</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {today?.sales.map((sale) => (
                      <tr key={sale._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors align-top">
                        <td className="py-2 pr-3 text-brand-dark/70 font-mono text-xs">{fmtTime(sale.saleDate)}</td>
                        <td className="py-2 pr-3 text-brand-dark/70">{sale.cashUserName || "—"}</td>
                        <td className="py-2 pr-3">
                          <span className="text-xs">{METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</span>
                          {sale.paymentMethod === "mixto" && sale.mixedPayment && (
                            <div className="mt-1 space-y-0.5">
                              {(["efectivo", "sinpe", "tarjeta"] as const).map((m) =>
                                (sale.mixedPayment![m] ?? 0) > 0 ? (
                                  <div key={m} className="text-xs text-brand-dark/50">
                                    {METHOD_LABELS[m]}: {fmt(sale.mixedPayment![m])}
                                  </div>
                                ) : null
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-right font-semibold text-brand-dark">{fmt(sale.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Productos vendidos */}
          {(today?.productsSummary.length ?? 0) > 0 && (
            <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-3">
              <h2 className="font-semibold text-brand-dark text-lg">Productos</h2>
              <div className="space-y-1">
                {today?.productsSummary.map((p) => (
                  <div
                    key={p.productId}
                    className={`flex items-center justify-between gap-2 py-2 border-b border-gray-50 text-sm ${
                      p.unitsSold === 0 ? "opacity-40" : ""
                    }`}
                  >
                    <span className="text-brand-dark">{p.productName}</span>
                    <span className={`font-bold tabular-nums ${p.unitsSold > 0 ? "text-brand-pink" : "text-brand-dark/40"}`}>
                      {p.unitsSold > 0 ? `${p.unitsSold} und.` : "Sin ventas"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Historial de cierres */}
        {closes.length > 0 && (
          <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-3 no-print">
            <h2 className="font-semibold text-brand-dark text-lg">Historial de cierres</h2>
            <div className="space-y-2">
              {closes.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-sm"
                >
                  <div>
                    <p className="font-medium text-brand-dark">{fmtDate(c.closeDate)}</p>
                    {c.closedBy && <p className="text-xs text-brand-dark/40">{c.closedBy}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{fmt(c.salesTotal)}</p>
                    <p className="text-xs text-brand-dark/40">Ganancia: {fmt(c.profit)}</p>
                    {c.arqueo && (
                      <p className={`text-xs mt-0.5 ${
                        c.arqueo.diferencia === 0 ? "text-emerald-600" :
                        c.arqueo.diferencia < 0   ? "text-red-500" : "text-amber-600"
                      }`}>
                        Arqueo: {fmt(c.arqueo.totalContado)}
                        {c.arqueo.diferencia !== 0 && ` (${c.arqueo.diferencia > 0 ? "+" : ""}${fmt(c.arqueo.diferencia)})`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
