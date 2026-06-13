"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Printer, Check, RefreshCw, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cashCloseTicket, DEFAULT_TICKET_CONFIG, type TicketConfigData } from "@/lib/ticket";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleRow {
  _id: string;
  cashUserName: string;
  paymentMethod: "efectivo" | "sinpe" | "tarjeta" | "mixto";
  mixedPayment?: { efectivo: number; sinpe: number; tarjeta: number };
  total: number;
  ticketNumber?: number;
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

interface CashWithdrawal {
  amount: number;
  leftAmount: number;
  note?: string;
  date: string;
}

interface CashCloseRow {
  _id: string;
  closeDate: string;
  closedBy: string;
  closeNumber?: number;
  salesTotal: number;
  expensesTotal: number;
  profit: number;
  paymentBreakdown: { efectivo: number; sinpe: number; tarjeta: number };
  arqueo?: {
    denominaciones?: { valor: number; cantidad: number; subtotal: number }[];
    totalContado: number;
    totalEsperado: number;
    diferencia: number;
  };
  openingAmount?: number;
  withdrawals?: CashWithdrawal[];
  withdrawalsTotal?: number;
  cashLeft?: number;
  salesList?: { ticketNumber: number; total: number }[];
  notes?: string;
}

interface CashSessionData {
  _id: string;
  status: "open" | "closed";
  openedAt: string;
  openingAmount: number;
  previousCashLeft?: number;
  countedAmount?: number;
  openingDifference?: number;
  withdrawals: CashWithdrawal[];
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
  const [businessName, setBusinessName] = useState("");
  const [ticketConfig, setTicketConfig] = useState<TicketConfigData>(DEFAULT_TICKET_CONFIG);
  const [loading, setLoading]     = useState(true);
  const [closing, setClosing]     = useState(false);
  const [closedToday, setClosedToday] = useState(false);
  const [counts, setCounts]       = useState<Record<number, number>>(
    Object.fromEntries(DENOMS.map((d) => [d.valor, 0]))
  );

  // ── Apertura / retiros de caja ────────────────────────────────────
  const [session, setSession] = useState<{ open: CashSessionData | null; previousCashLeft: number | null }>({ open: null, previousCashLeft: null });
  const [openingInput, setOpeningInput]   = useState(0);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawLeft, setWithdrawLeft]     = useState(0);
  const [withdrawNote, setWithdrawNote]     = useState("");
  const [withdrawing, setWithdrawing]       = useState(false);
  const [cashLeft, setCashLeft]             = useState(0);
  const [cashLeftTouched, setCashLeftTouched] = useState(false);
  const [notes, setNotes]                   = useState("");
  const [editMode, setEditMode]             = useState(false);
  const [todayCloseId, setTodayCloseId]     = useState<string | null>(null);
  const [closingWithdrawDone, setClosingWithdrawDone] = useState(false);
  const [savingEdit, setSavingEdit]         = useState(false);

  const loadData = useCallback(async () => {
    const [todayRes, closesRes, meRes, sessionRes] = await Promise.all([
      fetch("/api/admin/cash-close/today").then((r) => r.json()),
      fetch("/api/admin/cash-close").then((r) => r.json()),
      fetch("/api/admin/auth/me").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/cash-session").then((r) => r.json()).catch(() => ({ open: null, previousCashLeft: null })),
    ]);
    setToday(todayRes);
    setBusinessName(meRes.tenantName ?? "");
    if (meRes.ticketConfig) setTicketConfig({ ...DEFAULT_TICKET_CONFIG, ...meRes.ticketConfig });
    setSession({ open: sessionRes.open ?? null, previousCashLeft: sessionRes.previousCashLeft ?? null });
    const allCloses: CashCloseRow[] = closesRes.closes ?? [];
    setCloses(allCloses);
    // Verificar si ya se cerró hoy
    const todayStr = new Date().toDateString();
    const foundToday = allCloses.find((c) => new Date(c.closeDate).toDateString() === todayStr);
    setClosedToday(!!foundToday);
    if (foundToday) setTodayCloseId(foundToday._id);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derivados de arqueo / caja ────────────────────────────────────
  const totalContado = DENOMS.reduce((s, d) => s + d.valor * (counts[d.valor] ?? 0), 0);
  const withdrawalsList = session.open?.withdrawals ?? [];
  const withdrawalsTotal = withdrawalsList.reduce((s, w) => s + (w.amount ?? 0), 0);

  // En modo edición usa los datos guardados del cierre; si no, los de la sesión abierta
  const editingClose = closes.find((c) => c._id === todayCloseId) ?? null;
  const activeOpeningAmount = editMode
    ? (editingClose?.openingAmount ?? 0)
    : (session.open?.openingAmount ?? 0);
  const activeWithdrawalsTotal = editMode
    ? (editingClose?.withdrawalsTotal ?? 0)
    : withdrawalsTotal;
  const efectivoEsperado = activeOpeningAmount + (today?.paymentBreakdown.efectivo ?? 0) - activeWithdrawalsTotal;
  const diferencia = totalContado - efectivoEsperado;
  const defaultCashLeft = withdrawalsList.length > 0 ? withdrawalsList[withdrawalsList.length - 1].leftAmount : totalContado;

  useEffect(() => {
    if (!cashLeftTouched) setCashLeft(defaultCashLeft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCashLeft, cashLeftTouched]);

  async function handleOpenSession() {
    setOpeningLoading(true);
    try {
      const body = session.previousCashLeft === null
        ? { openingAmount: openingInput }
        : { openingAmount: session.previousCashLeft, countedAmount: openingInput };
      const res = await fetch("/api/admin/cash-session/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOpeningInput(0);
        await loadData();
      }
    } finally {
      setOpeningLoading(false);
    }
  }

  async function handleWithdraw() {
    if (withdrawAmount <= 0) return;
    setWithdrawing(true);
    try {
      const res = await fetch("/api/admin/cash-session/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: withdrawAmount, leftAmount: withdrawLeft, note: withdrawNote }),
      });
      if (res.ok) {
        setWithdrawAmount(0);
        setWithdrawLeft(0);
        setWithdrawNote("");
        await loadData();
      }
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleClosingWithdrawal() {
    const base = totalContado > 0 ? totalContado : efectivoEsperado;
    const amount = base - cashLeft;
    if (amount <= 0 || !session.open) return;
    setWithdrawing(true);
    try {
      const res = await fetch("/api/admin/cash-session/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, leftAmount: cashLeft, note: "Retiro al cierre del día" }),
      });
      if (res.ok) {
        // Reset denomination counts — user needs to re-count only what queda en caja
        const fresh: Record<number, number> = {};
        for (const d of DENOMS) fresh[d.valor] = 0;
        setCounts(fresh);
        setClosingWithdrawDone(true);
        await loadData();
      }
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleClose() {
    if (!today) return;
    setClosing(true);
    try {
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
          openingAmount:    session.open?.openingAmount ?? 0,
          withdrawals:      session.open?.withdrawals ?? [],
          withdrawalsTotal,
          cashLeft,
          salesList: today.sales.map((s) => ({ ticketNumber: s.ticketNumber ?? 0, total: s.total })),
          notes,
        }),
      });
      setCounts(Object.fromEntries(DENOMS.map((d) => [d.valor, 0])));
      setNotes("");
      setCashLeftTouched(false);
      await loadData();
    } finally {
      setClosing(false);
    }
  }

  function handleEnterEdit() {
    if (!editingClose) return;
    const newCounts = Object.fromEntries(DENOMS.map((d) => [d.valor, 0]));
    for (const denom of (editingClose.arqueo?.denominaciones ?? [])) {
      newCounts[denom.valor] = denom.cantidad;
    }
    setCounts(newCounts);
    setCashLeft(editingClose.cashLeft ?? 0);
    setCashLeftTouched(true);
    setNotes(editingClose.notes ?? "");
    setEditMode(true);
  }

  function handleCancelEdit() {
    setEditMode(false);
    setCounts(Object.fromEntries(DENOMS.map((d) => [d.valor, 0])));
    setCashLeft(0);
    setCashLeftTouched(false);
    setNotes("");
  }

  async function handleSaveEdit() {
    if (!todayCloseId) return;
    setSavingEdit(true);
    try {
      const denominaciones = DENOMS
        .filter((d) => (counts[d.valor] ?? 0) > 0)
        .map((d) => ({ valor: d.valor, cantidad: counts[d.valor], subtotal: d.valor * counts[d.valor] }));

      await fetch(`/api/admin/cash-close/${todayCloseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arqueo: totalContado > 0 ? {
            denominaciones,
            totalContado,
            totalEsperado: efectivoEsperado,
            diferencia,
          } : undefined,
          cashLeft,
          notes,
        }),
      });
      setEditMode(false);
      setCashLeftTouched(false);
      await loadData();
    } finally {
      setSavingEdit(false);
    }
  }

  function handlePrint() {
    if (!today) return;
    const closeNumber = closedToday
      ? (closes[0]?.closeNumber ?? closes.length)
      : (closes[0]?.closeNumber ?? 0) + 1;
    // Cuando la caja ya está cerrada, los datos correctos están en editingClose (DB).
    // session.open es null en ese punto y daría openingAmount=0 y withdrawals=[].
    cashCloseTicket({
      businessName: businessName || "Mi negocio",
      closeNumber,
      date: editingClose?.closeDate ?? new Date().toISOString(),
      paymentBreakdown: today.paymentBreakdown,
      salesTotal: today.salesTotal,
      expensesTotal: today.expensesTotal,
      profit: today.profit,
      productsSummary: today.productsSummary,
      arqueo: editingClose?.arqueo
        ?? (totalContado > 0 ? { totalContado, totalEsperado: efectivoEsperado, diferencia } : undefined),
      openingAmount: editingClose?.openingAmount ?? session.open?.openingAmount ?? 0,
      withdrawals: editingClose?.withdrawals ?? session.open?.withdrawals ?? [],
      withdrawalsTotal: editingClose?.withdrawalsTotal ?? withdrawalsTotal,
      cashLeft: editingClose?.cashLeft ?? cashLeft,
      salesList: today.sales.map((s) => ({ ticketNumber: s.ticketNumber ?? 0, total: s.total })),
      notes: editingClose?.notes ?? notes,
    }, ticketConfig);
  }

  function printHistoryTicket(c: CashCloseRow, index: number) {
    // closes viene ordenado de más reciente a más antiguo → número = total - index (fallback para cierres viejos sin closeNumber)
    cashCloseTicket({
      businessName: businessName || "Mi negocio",
      closeNumber: c.closeNumber ?? (closes.length - index),
      date: c.closeDate,
      closedBy: c.closedBy,
      paymentBreakdown: c.paymentBreakdown,
      salesTotal: c.salesTotal,
      expensesTotal: c.expensesTotal,
      profit: c.profit,
      arqueo: c.arqueo,
      openingAmount: c.openingAmount,
      withdrawals: c.withdrawals,
      withdrawalsTotal: c.withdrawalsTotal,
      cashLeft: c.cashLeft,
      salesList: c.salesList,
      notes: c.notes,
    }, ticketConfig);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  const monedas  = DENOMS.filter((d) => d.tipo === "moneda");
  const billetes = DENOMS.filter((d) => d.tipo === "billete");
  const showArqueo = (session.open && !closedToday) || editMode;

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

      <div className="max-w-5xl mx-auto py-6 px-4">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <div className="flex items-center gap-3">
            <h1 className="font-brand text-xl sm:text-2xl font-bold text-brand-dark">Cierre de caja</h1>
            {session.open && !closedToday && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                Caja abierta
              </span>
            )}
            {closedToday && !editMode && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                <Check className="w-3 h-3" /> Caja cerrada
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button" onClick={loadData}
              className="p-2 rounded-xl border border-brand-muted text-brand-dark/50 hover:text-brand-dark hover:bg-brand-muted/20 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* PDF: siempre visible, deshabilitado hasta que caja esté cerrada */}
            <Button
              variant="secondary" onClick={handlePrint}
              disabled={!closedToday}
              title={!closedToday ? "Disponible al cerrar la caja" : undefined}
              className="gap-2 text-sm"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Ticket </span>PDF
            </Button>
            {closedToday && !editMode && (
              <Button variant="secondary" onClick={handleEnterEdit} className="gap-2 text-sm">
                <Pencil className="w-4 h-4" />
                Editar cierre
              </Button>
            )}
            {editMode && (
              <>
                <Button variant="secondary" onClick={handleCancelEdit} className="gap-2 text-sm">
                  <X className="w-4 h-4" /> Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit} className="gap-2 text-sm">
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar cambios
                </Button>
              </>
            )}
            {!closedToday && !editMode && (
              <Button
                onClick={handleClose}
                disabled={closing || !today?.sales.length || !session.open}
                className="gap-2 text-sm"
              >
                {closing && <Loader2 className="w-4 h-4 animate-spin" />}
                Cerrar el día
              </Button>
            )}
          </div>
        </div>

        {/* ── ESTADO: Sin sesión, sin cierre → solo apertura ───────── */}
        {!session.open && !closedToday && (
          <div className="max-w-md mx-auto">
            <section className="bg-white rounded-2xl border border-brand-muted p-6 space-y-4">
              <h2 className="font-semibold text-brand-dark text-lg">Apertura de caja</h2>
              {session.previousCashLeft === null ? (
                <p className="text-sm text-brand-dark/50">
                  Primera vez que abrís la caja. Contá el efectivo físico actual para definir la caja inicial.
                </p>
              ) : (
                <p className="text-sm text-brand-dark/50">
                  Caja inicial (lo dejado ayer):{" "}
                  <span className="font-semibold text-brand-dark">{fmt(session.previousCashLeft)}</span>.
                  Contá el efectivo actual para verificarlo.
                </p>
              )}
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-brand-dark mb-1">
                    {session.previousCashLeft === null ? "Efectivo actual en caja" : "Efectivo contado ahora"}
                  </label>
                  <input
                    type="number" min={0} step={1}
                    value={openingInput || ""} placeholder="0"
                    onChange={(e) => setOpeningInput(Math.max(0, Number(e.target.value)))}
                    className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                  />
                </div>
                <Button onClick={handleOpenSession} disabled={openingLoading} className="gap-2 shrink-0">
                  {openingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Abrir caja
                </Button>
              </div>
            </section>
          </div>
        )}

        {/* ── ESTADO: Caja abierta o modo edición → layout 2 columnas ── */}
        {showArqueo && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" id="print-area">

            {/* ── Columna izquierda: resumen + retiros ─────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Print header */}
              <div className="hidden print:block text-center mb-2">
                <p className="font-bold text-lg">Reporte de cierre de caja</p>
                <p className="text-sm text-gray-500">{today?.date ? fmtDate(today.date) : ""}</p>
              </div>

              {/* Resumen del día */}
              <section className="bg-white rounded-2xl border border-brand-muted p-4 space-y-3">
                <h2 className="font-semibold text-brand-dark">
                  {today?.date ? fmtDate(today.date) : "Hoy"}
                  {(today?.sales.length ?? 0) === 0 && (
                    <span className="ml-2 text-xs font-normal text-brand-dark/40">Sin ventas</span>
                  )}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Ventas",   value: fmt(today?.salesTotal ?? 0),   color: "text-emerald-600" },
                    { label: "Gastos",   value: fmt(today?.expensesTotal ?? 0), color: "text-red-500" },
                    { label: "Ganancia", value: fmt(today?.profit ?? 0),        color: (today?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500" },
                    { label: "Facturas", value: String(today?.sales.length ?? 0), color: "text-brand-pink" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-xs text-brand-dark/50">{kpi.label}</p>
                      <p className={`text-base font-bold ${kpi.color}`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-brand-muted/50">
                  {(["efectivo", "sinpe", "tarjeta"] as const).map((m) => (
                    <div key={m} className="text-center">
                      <p className="text-[10px] text-brand-dark/40 mb-0.5">{METHOD_LABELS[m]}</p>
                      <p className="text-sm font-bold text-brand-dark">{fmt(today?.paymentBreakdown[m] ?? 0)}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Retiros — solo con sesión abierta */}
              {session.open && !editMode && (
                <section className="bg-white rounded-2xl border border-brand-muted p-4 space-y-3 no-print">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-brand-dark">Retiros de caja</h2>
                    <span className="text-xs text-brand-dark/50">
                      C. inicial: <span className="font-semibold text-brand-dark">{fmt(session.open.openingAmount)}</span>
                    </span>
                  </div>

                  {session.open.openingDifference != null && session.open.openingDifference !== 0 && (
                    <div className={`rounded-xl px-3 py-2 text-xs font-medium ${
                      session.open.openingDifference < 0
                        ? "bg-red-50 border border-red-200 text-red-700"
                        : "bg-amber-50 border border-amber-200 text-amber-700"
                    }`}>
                      {session.open.openingDifference < 0
                        ? `⚠ Faltan ${fmt(Math.abs(session.open.openingDifference))} respecto a ayer.`
                        : `ℹ Sobran ${fmt(session.open.openingDifference)} respecto a ayer.`}
                    </div>
                  )}

                  {session.open.withdrawals.length > 0 && (
                    <div className="space-y-1">
                      {session.open.withdrawals.map((w, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm border-b border-gray-50 py-1">
                          <div>
                            <span className="text-brand-dark/60 font-mono text-xs">{fmtTime(w.date)}</span>
                            {w.note && <span className="ml-1.5 text-brand-dark/40 text-xs">{w.note}</span>}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-brand-dark text-xs">−{fmt(w.amount)}</p>
                            <p className="text-[10px] text-brand-dark/40">Dejó: {fmt(w.leftAmount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Retirar",        value: withdrawAmount, set: (v: number) => setWithdrawAmount(v) },
                      { label: "Dejar en caja",  value: withdrawLeft,   set: (v: number) => setWithdrawLeft(v) },
                    ].map(({ label, value, set }) => (
                      <div key={label} className="col-span-1">
                        <label className="block text-xs font-medium text-brand-dark mb-1">{label}</label>
                        <input
                          type="number" min={0} step={1}
                          value={value || ""} placeholder="0"
                          onChange={(e) => set(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-brand-muted rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-brand-dark mb-1">Nota</label>
                      <input
                        type="text" value={withdrawNote} placeholder="Opcional"
                        onChange={(e) => setWithdrawNote(e.target.value)}
                        className="w-full border border-brand-muted rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
                      />
                    </div>
                  </div>
                  <Button onClick={handleWithdraw} disabled={withdrawing || withdrawAmount <= 0} className="gap-2 text-sm w-full">
                    {withdrawing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Registrar retiro
                  </Button>
                </section>
              )}
            </div>

            {/* ── Columna derecha: arqueo compacto + cierre ────────── */}
            <div className="lg:col-span-3 space-y-4">
              <section className={`bg-white rounded-2xl border p-4 space-y-3 no-print ${editMode ? "border-amber-300 ring-2 ring-amber-100" : "border-brand-muted"}`}>

                {/* Header con total en vivo */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-brand-dark">Arqueo de caja</h2>
                      {editMode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                          <Pencil className="w-2.5 h-2.5" /> Editando
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-dark/40 mt-0.5">Ingresá la cantidad de cada denominación.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-brand-dark/40 uppercase tracking-wider">Total contado</p>
                    <p className={`text-xl font-bold tabular-nums ${totalContado > 0 ? "text-brand-dark" : "text-brand-dark/30"}`}>
                      {fmt(totalContado)}
                    </p>
                  </div>
                </div>

                {/* Cuadrícula compacta: monedas | billetes */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                  {/* Monedas */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark/40 mb-2">Monedas</p>
                    <div className="space-y-1">
                      {monedas.map((d) => (
                        <div key={d.valor} className="flex items-center gap-1.5">
                          <span className="text-xs text-brand-dark w-10 shrink-0">{d.label}</span>
                          <input
                            type="number" min={0} step={1}
                            value={counts[d.valor] || ""} placeholder="0"
                            onChange={(e) => setCounts((prev) => ({ ...prev, [d.valor]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-14 text-center border border-brand-muted rounded-md px-1.5 py-1 text-xs focus:outline-none focus:border-brand-pink"
                          />
                          <span className="text-[11px] text-brand-dark/50 tabular-nums flex-1 text-right">
                            {d.valor * (counts[d.valor] ?? 0) > 0 ? fmt(d.valor * (counts[d.valor] ?? 0)) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Billetes */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark/40 mb-2">Billetes</p>
                    <div className="space-y-1">
                      {billetes.map((d) => (
                        <div key={d.valor} className="flex items-center gap-1.5">
                          <span className="text-xs text-brand-dark w-14 shrink-0">{d.label}</span>
                          <input
                            type="number" min={0} step={1}
                            value={counts[d.valor] || ""} placeholder="0"
                            onChange={(e) => setCounts((prev) => ({ ...prev, [d.valor]: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-14 text-center border border-brand-muted rounded-md px-1.5 py-1 text-xs focus:outline-none focus:border-brand-pink"
                          />
                          <span className="text-[11px] text-brand-dark/50 tabular-nums flex-1 text-right">
                            {d.valor * (counts[d.valor] ?? 0) > 0 ? fmt(d.valor * (counts[d.valor] ?? 0)) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Comparativa en tiempo real */}
                <div className="border-t border-brand-muted/50 pt-2.5 space-y-1.5">
                  <div className="flex justify-between text-xs text-brand-dark/60">
                    <span>Efectivo esperado en caja</span>
                    <span className="tabular-nums font-medium text-brand-dark">{fmt(efectivoEsperado)}</span>
                  </div>
                  {totalContado > 0 && (
                    <div className={`flex justify-between items-center text-xs font-semibold rounded-lg px-3 py-2 ${
                      diferencia === 0
                        ? "bg-emerald-50 text-emerald-700"
                        : diferencia < 0
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      <span>
                        {diferencia === 0 && "✓ Cuadra exacto"}
                        {diferencia < 0 && `⚠ Faltante`}
                        {diferencia > 0 && `ℹ Sobrante`}
                      </span>
                      <span className="tabular-nums">
                        {diferencia !== 0 && `${diferencia > 0 ? "+" : ""}${fmt(diferencia)}`}
                      </span>
                    </div>
                  )}

                  {/* Banner de retiro de cierre */}
                  {(() => {
                    const base = totalContado > 0 ? totalContado : efectivoEsperado;
                    const retiro = base - cashLeft;
                    if (closingWithdrawDone || cashLeft <= 0 || retiro <= 0) return null;
                    return (
                      <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-blue-800">Retiro al cierre</p>
                          <p className="text-[11px] text-blue-600">
                            Retirás {fmt(retiro)} y dejás {fmt(cashLeft)} en caja.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleClosingWithdrawal}
                          disabled={withdrawing}
                          className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {withdrawing ? "..." : `Retirar ${fmt(retiro)}`}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Mensaje post-retiro: re-contar lo que queda */}
                  {closingWithdrawDone && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-800">✓ Retiro registrado</p>
                      <p className="text-[11px] text-emerald-700">
                        Ahora contá las denominaciones que quedan en caja ({fmt(cashLeft)}).
                      </p>
                    </div>
                  )}
                </div>

                {/* Dejo en caja + Observaciones */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-brand-muted/50">
                  <div>
                    <label className="block text-xs font-medium text-brand-dark mb-1">Dejo en caja</label>
                    <input
                      type="number" min={0} step={1}
                      value={cashLeft || ""} placeholder="0"
                      onChange={(e) => { setCashLeft(Math.max(0, Number(e.target.value))); setCashLeftTouched(true); }}
                      className="w-full border border-brand-muted rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-brand-pink"
                    />
                    <p className="text-[10px] text-brand-dark/40 mt-0.5">Caja inicial de mañana</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-dark mb-1">Observaciones</label>
                    <textarea
                      rows={2}
                      value={notes} placeholder="Notas (opcional)"
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full border border-brand-muted rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-pink resize-none"
                    />
                  </div>
                </div>

                {/* Botón de cierre — dentro del panel en desktop */}
                {!editMode && (
                  <Button
                    onClick={handleClose}
                    disabled={closing || !today?.sales.length || !session.open}
                    className="w-full gap-2"
                  >
                    {closing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Cerrar el día
                  </Button>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ── Ventas del día + Productos (debajo del grid) ─────────── */}
        {(showArqueo || closedToday) && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5" id="print-area">

            {/* Ventas del día */}
            {(today?.sales.length ?? 0) > 0 && (
              <section className="bg-white rounded-2xl border border-brand-muted p-4 space-y-3">
                <h2 className="font-semibold text-brand-dark">Ventas del día</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-muted text-brand-dark/50 text-xs">
                        <th className="text-left py-1.5 pr-3 font-medium">Hora</th>
                        <th className="text-left py-1.5 pr-3 font-medium">Encargado</th>
                        <th className="text-left py-1.5 pr-3 font-medium">Método</th>
                        <th className="text-right py-1.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {today?.sales.map((sale) => (
                        <tr key={sale._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors align-top">
                          <td className="py-1.5 pr-3 text-brand-dark/60 font-mono text-xs">{fmtTime(sale.saleDate)}</td>
                          <td className="py-1.5 pr-3 text-brand-dark/70 text-xs">{sale.cashUserName || "—"}</td>
                          <td className="py-1.5 pr-3">
                            <span className="text-xs">{METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</span>
                            {sale.paymentMethod === "mixto" && sale.mixedPayment && (
                              <div className="mt-0.5 space-y-0.5">
                                {(["efectivo", "sinpe", "tarjeta"] as const).map((m) =>
                                  (sale.mixedPayment![m] ?? 0) > 0 ? (
                                    <div key={m} className="text-[10px] text-brand-dark/40">
                                      {METHOD_LABELS[m]}: {fmt(sale.mixedPayment![m])}
                                    </div>
                                  ) : null
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-brand-dark text-sm">{fmt(sale.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Productos vendidos */}
            {(today?.productsSummary.filter((p) => p.unitsSold > 0).length ?? 0) > 0 && (
              <section className="bg-white rounded-2xl border border-brand-muted p-4 space-y-3">
                <h2 className="font-semibold text-brand-dark">Productos vendidos</h2>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {today?.productsSummary.filter((p) => p.unitsSold > 0).map((p) => (
                    <div key={p.productId} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 text-sm">
                      <span className="text-brand-dark text-sm">{p.productName}</span>
                      <span className="font-bold tabular-nums text-brand-pink text-xs shrink-0">{p.unitsSold} und.</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── ESTADO: Caja cerrada → resumen del cierre ────────────── */}
        {closedToday && !editMode && editingClose && (
          <section className="mt-5 bg-white rounded-2xl border border-emerald-200 p-4 space-y-3 no-print">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <h2 className="font-semibold text-brand-dark">Cierre registrado</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-xs text-brand-dark/50 mb-0.5">C. Inicial</p>
                <p className="font-semibold">{fmt(editingClose.openingAmount ?? 0)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-xs text-brand-dark/50 mb-0.5">Dejo en caja</p>
                <p className="font-semibold">{fmt(editingClose.cashLeft ?? 0)}</p>
              </div>
              {editingClose.arqueo && (
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-xs text-brand-dark/50 mb-0.5">Arqueo contado</p>
                  <p className={`font-semibold ${editingClose.arqueo.diferencia === 0 ? "text-emerald-600" : editingClose.arqueo.diferencia < 0 ? "text-red-500" : "text-amber-600"}`}>
                    {fmt(editingClose.arqueo.totalContado)}
                    {editingClose.arqueo.diferencia !== 0 && (
                      <span className="ml-1 text-xs">({editingClose.arqueo.diferencia > 0 ? "+" : ""}{fmt(editingClose.arqueo.diferencia)})</span>
                    )}
                  </p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-xs text-brand-dark/50 mb-0.5">Ganancia neta</p>
                <p className={`font-semibold ${(today?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {fmt(today?.profit ?? 0)}
                </p>
              </div>
            </div>
            {editingClose.notes && (
              <p className="text-xs text-brand-dark/50 italic border-t border-brand-muted/50 pt-2">{editingClose.notes}</p>
            )}
          </section>
        )}

        {/* ── Historial de cierres ──────────────────────────────────── */}
        {closes.length > 0 && (
          <section className="mt-5 bg-white rounded-2xl border border-brand-muted p-4 space-y-3 no-print">
            <h2 className="font-semibold text-brand-dark">Historial de cierres</h2>
            <div className="space-y-2">
              {closes.map((c, i) => (
                <div key={c._id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                  <div>
                    <p className="font-medium text-brand-dark text-sm">{fmtDate(c.closeDate)}</p>
                    {c.closedBy && <p className="text-xs text-brand-dark/40">{c.closedBy}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-sm">{fmt(c.salesTotal)}</p>
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
                    <button
                      type="button"
                      onClick={() => printHistoryTicket(c, i)}
                      title="Descargar ticket PDF"
                      className="p-2 rounded-lg border border-brand-muted text-brand-dark/50 hover:text-brand-pink hover:border-brand-pink/40 transition-colors shrink-0"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
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
