"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OrderForm from "@/components/admin/OrderForm";
import Pagination from "@/components/admin/Pagination";
import PeriodFilter, { getRange, PeriodMode } from "@/components/admin/PeriodFilter";
import { IOrder } from "@/models/Order";
import { Plus, CheckCircle, Trash2, Phone, Pencil, Search, MonitorCheck, Loader2, Minus, X, Printer, FileText, Check, AlertCircle } from "lucide-react";
import { saleTicket, DEFAULT_TICKET_CONFIG, type SaleTicketData, type TicketConfigData } from "@/lib/ticket";
import { checkAgent, printReceipt, buildSalePayload } from "@/lib/printBridge";
import { computeSaleTotals, isOrderType, lineTotal, subtotalOf } from "@/lib/pricing";

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface VentaItem {
  id: string;
  source: "pos" | "manual";
  date: string;
  customerName: string;
  total: number;
  paid: boolean;
  paymentMethod?: string;
  cashierName?: string;
  phone?: string;
  notes?: string;
  itemCount: number;
  ticketNumber?: number | null;
}

interface VentaStats {
  pagado: number;
  porCobrar: number;
  total: number;
}

type OrderRow = IOrder & { _id: string };

interface SaleItem { productId: string; productName: string; unitPrice: number; quantity: number; }
interface FullSale {
  _id: string;
  ticketNumber?: number;
  customerName: string;
  tableNumber: string;
  cashUserId: string;
  cashUserName: string;
  items: SaleItem[];
  paymentMethod: "efectivo" | "sinpe" | "tarjeta" | "mixto";
  mixedPayment: { efectivo: number; sinpe: number; tarjeta: number };
  ivaEnabled: boolean; ivaRate: number; ivaAmount: number;
  serviceEnabled: boolean; serviceRate: number; serviceAmount: number;
  tipEnabled: boolean; tipAmount: number;
  subtotal: number; total: number;
  orderType?: string;
  deliveryFee?: number;
  notes?: string;
  saleDate?: string;
}
interface ProductOption { _id: string; name: string; price: number; }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  // Period filter state
  const [periodMode, setPeriodMode] = useState<PeriodMode>("dia");
  const [anchor, setAnchor]         = useState(() => new Date());

  // Unified list state
  const [items, setItems]   = useState<VentaItem[]>([]);
  const [stats, setStats]   = useState<VentaStats>({ pagado: 0, porCobrar: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // Status filter + search (client-side)
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("all");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Manual order dialogs
  const [showForm, setShowForm]         = useState(false);
  const [editOrder, setEditOrder]       = useState<OrderRow | null>(null);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Eliminar venta POS (con contraseña)
  const [confirmDeleteSale, setConfirmDeleteSale] = useState<VentaItem | null>(null);
  const [deleteSalePassword, setDeleteSalePassword] = useState("");
  const [deletingSale, setDeletingSale] = useState(false);
  const [deleteSaleError, setDeleteSaleError] = useState<string | null>(null);

  // Ticket config for reprints
  const [businessName, setBusinessName] = useState("");
  const [ticketConfig, setTicketConfig] = useState<TicketConfigData>(DEFAULT_TICKET_CONFIG);

  // Reimpresión térmica por fila (nunca afecta a otras filas)
  const [printStates, setPrintStates] = useState<Record<string, "checking" | "printing" | "success" | "error">>({});
  const [printBanner, setPrintBanner] = useState<string | null>(null);

  // POS sale edit
  const [editSale, setEditSale]         = useState<FullSale | null>(null);
  const [savingSale, setSavingSale]     = useState(false);
  const [saleProducts, setSaleProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getRange(periodMode, anchor);
    const url = `/api/admin/ventas?from=${from.toISOString()}&to=${to.toISOString()}`;
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.items ?? []);
    setStats(data.stats ?? { pagado: 0, porCobrar: 0, total: 0 });
    setLoading(false);
  }, [periodMode, anchor]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/admin/auth/me").then((r) => r.json()).then((d) => {
      if (d.tenantName) setBusinessName(d.tenantName);
      if (d.ticketConfig) setTicketConfig({ ...DEFAULT_TICKET_CONFIG, ...d.ticketConfig });
    }).catch(() => {});
  }, []);

  // ── Manual order handlers ──────────────────────────────────────────────────

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  }

  async function handleEditSave(data: Record<string, unknown>) {
    if (!editOrder) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${editOrder._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setEditOrder(null);
      await load();
    } finally { setSaving(false); }
  }

  async function togglePaid(id: string, paid: boolean) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  function isToday(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }

  function openDeleteSale(item: VentaItem) {
    setConfirmDeleteSale(item);
    setDeleteSalePassword("");
    setDeleteSaleError(null);
  }

  function closeDeleteSale() {
    setConfirmDeleteSale(null);
    setDeleteSalePassword("");
    setDeleteSaleError(null);
  }

  async function handleDeleteSale() {
    if (!confirmDeleteSale) return;
    setDeletingSale(true);
    setDeleteSaleError(null);
    try {
      const res = await fetch(`/api/admin/sales/${confirmDeleteSale.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deleteSalePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteSaleError(data.error ?? "No se pudo eliminar la venta");
        return;
      }
      closeDeleteSale();
      await load();
    } catch {
      setDeleteSaleError("Error de conexión");
    } finally {
      setDeletingSale(false);
    }
  }

  /** GET la venta y arma el SaleTicketData; null si no existe. No dispara ninguna impresión. */
  async function fetchSaleTicketData(id: string): Promise<SaleTicketData | null> {
    const saleRes = await fetch(`/api/admin/sales/${id}`).then((r) => r.json());
    const s = saleRes.sale;
    if (!s) return null;
    const saleNumber = String(s._id).slice(-6).toUpperCase();
    return {
      businessName,
      ticketNumber: s.ticketNumber,
      saleNumber,
      date: s.saleDate ?? s.createdAt,
      cashUserName: s.cashUserName,
      customerName: s.customerName,
      tableNumber: s.tableNumber,
      items: s.items,
      subtotal: s.subtotal,
      ivaEnabled: s.ivaEnabled, ivaRate: s.ivaRate, ivaAmount: s.ivaAmount,
      serviceEnabled: s.serviceEnabled, serviceRate: s.serviceRate, serviceAmount: s.serviceAmount,
      tipEnabled: s.tipEnabled, tipAmount: s.tipAmount,
      total: s.total,
      paymentMethod: s.paymentMethod,
      mixedPayment: s.mixedPayment,
      notes: s.notes,
    };
  }

  async function handleDownloadPdf(item: VentaItem) {
    const data = await fetchSaleTicketData(item.id);
    if (!data) return;
    await saleTicket({ ...data, isReprint: true }, ticketConfig);
  }

  /**
   * Imprime en la térmica (sin abrir la gaveta) el tiquete de una venta ya guardada.
   * Estado por fila (nunca global): imprimir una no afecta a las demás. Reusado por
   * el botón "Reimprimir en térmica" y por el auto-print tras editar una venta.
   */
  async function runThermalPrint(id: string) {
    setPrintStates((p) => ({ ...p, [id]: "checking" }));
    const health = await checkAgent();
    if (!health) {
      setPrintStates((p) => ({ ...p, [id]: "error" }));
      setPrintBanner(`Venta #${id.slice(-6).toUpperCase()}: el agente de impresión no responde en esta computadora.`);
      return;
    }
    setPrintStates((p) => ({ ...p, [id]: "printing" }));
    try {
      const data = await fetchSaleTicketData(id);
      if (!data) throw new Error("No se pudo cargar la venta para imprimir");
      const result = await printReceipt(buildSalePayload({ ...data, isReprint: true }, ticketConfig, false));
      if (!result.ok) {
        const detalle = result.detalles?.errores?.length ? `: ${result.detalles.errores.join("; ")}` : "";
        throw new Error(`${result.mensaje}${detalle}`);
      }
      setPrintStates((p) => ({ ...p, [id]: "success" }));
      setTimeout(() => setPrintStates((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      }), 2000);
    } catch (err) {
      setPrintStates((p) => ({ ...p, [id]: "error" }));
      const saleLabel = `Venta #${id.slice(-6).toUpperCase()}`;
      setPrintBanner(`${saleLabel}: ${err instanceof Error ? err.message : "Error de conexión con el agente"}`);
    }
  }

  async function handleThermalReprint(item: VentaItem) {
    await runThermalPrint(item.id);
  }

  async function openSaleEdit(id: string) {
    const [saleRes, productsRes] = await Promise.all([
      fetch(`/api/admin/sales/${id}`).then((r) => r.json()),
      fetch("/api/admin/products").then((r) => r.json()),
    ]);
    if (saleRes.sale) setEditSale(saleRes.sale);
    setSaleProducts(productsRes.products ?? []);
  }

  async function handleSaleSave() {
    if (!editSale) return;
    setSavingSale(true);
    try {
      const id = editSale._id;
      await fetch(`/api/admin/sales/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSale),
      });
      setEditSale(null);
      await load();
      // La venta ya quedó guardada; la impresión es best-effort y no bloquea el
      // guardado. Si falla, el banner y el botón de la fila permiten reintentar.
      runThermalPrint(id);
    } finally { setSavingSale(false); }
  }

  function updateSaleItem(productId: string, delta: number) {
    setEditSale((prev) => {
      if (!prev) return prev;
      const items = prev.items
        .map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0);
      return { ...prev, items };
    });
  }

  function addSaleProduct(p: ProductOption) {
    setEditSale((prev) => {
      if (!prev) return prev;
      const existing = prev.items.find((i) => i.productId === p._id);
      if (existing) {
        return { ...prev, items: prev.items.map((i) => i.productId === p._id ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return { ...prev, items: [...prev.items, { productId: p._id, productName: p.name, unitPrice: p.price, quantity: 1 }] };
    });
    setProductSearch("");
    setShowProductDrop(false);
  }

  // ── Client-side filtering ──────────────────────────────────────────────────

  const filtered = items
    .filter((i) =>
      filter === "all"     ? true :
      filter === "paid"    ? i.paid :
                             !i.paid
    )
    .filter((i) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        i.customerName.toLowerCase().includes(q) ||
        (i.phone ?? "").includes(q) ||
        (i.cashierName ?? "").toLowerCase().includes(q)
      );
    });

  const totalPages   = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage     = Math.min(page, totalPages);
  const display      = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Pedidos y ventas</h1>
          <p className="text-brand-dark/50 text-sm mt-1">
            {items.filter((i) => i.paid).length} pagados · {items.filter((i) => !i.paid).length} pendientes
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nuevo pedido
        </Button>
      </div>

      {/* Period filter */}
      <PeriodFilter
        mode={periodMode}
        anchor={anchor}
        onChange={(m, a) => { setPeriodMode(m); setAnchor(a); setPage(1); }}
      />

      {/* Status tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {(["all", "pending", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
                filter === f
                  ? "gradient-bg text-white border-transparent"
                  : "bg-white text-brand-dark/60 border-brand-muted hover:border-brand-pink/30"
              }`}
            >
              {f === "all" ? "Todos" : f === "paid" ? "Pagados" : "Pendientes"}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-dark/30" />
          <input
            type="text"
            placeholder="Buscar cliente o cajero..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 pr-3 py-1.5 border border-brand-muted rounded-full text-sm focus:outline-none focus:border-brand-pink w-full sm:w-64"
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="flex flex-wrap gap-3">
        {(filter === "all" || filter === "paid") && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="text-emerald-500 text-lg">✅</span>
            <div>
              <p className="text-xs text-emerald-600/70 font-medium">{filter === "all" ? "Total pagado" : "Pagados"}</p>
              <p className="text-base font-bold text-emerald-700">₡{stats.pagado.toLocaleString("es-CR")}</p>
            </div>
          </div>
        )}
        {(filter === "all" || filter === "pending") && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100">
            <span className="text-orange-400 text-lg">⏳</span>
            <div>
              <p className="text-xs text-orange-500/80 font-medium">{filter === "all" ? "Por cobrar" : "Pendientes"}</p>
              <p className="text-base font-bold text-orange-600">₡{stats.porCobrar.toLocaleString("es-CR")}</p>
            </div>
          </div>
        )}
        {filter === "all" && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-muted border border-brand-pink/10">
            <span className="text-brand-pink text-lg">📊</span>
            <div>
              <p className="text-xs text-brand-dark/50 font-medium">Total general</p>
              <p className="text-base font-bold text-brand-dark">₡{stats.total.toLocaleString("es-CR")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Aviso de impresión térmica (descartable) */}
      {printBanner && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{printBanner}</p>
          </div>
          <button type="button" onClick={() => setPrintBanner(null)} className="shrink-0 text-red-400 hover:text-red-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Cliente / Origen</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Fecha y hora</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Detalle</th>
                  <th className="text-left px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {display.map((item) => (
                  <tr key={item.id} className="border-b border-brand-muted/50 hover:bg-brand-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.source === "pos" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold shrink-0">
                            <MonitorCheck className="w-2.5 h-2.5" /> POS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold shrink-0">
                            Manual
                          </span>
                        )}
                        <p className="font-medium text-brand-dark">{item.customerName}</p>
                      </div>
                      {item.source === "manual" && item.phone && (
                        <a
                          href={`https://wa.me/${item.phone.replace(/\D/g, "")}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-[#25D366] hover:underline mt-0.5"
                        >
                          <Phone className="w-3 h-3" /> {item.phone}
                        </a>
                      )}
                      {item.source === "pos" && item.cashierName && (
                        <p className="text-xs text-brand-dark/40 mt-0.5">{item.cashierName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-brand-dark/60 text-xs">
                      {new Date(item.date).toLocaleDateString("es-CR", { day:"2-digit", month:"short" })}
                      {" "}
                      {new Date(item.date).toLocaleTimeString("es-CR", { hour:"2-digit", minute:"2-digit" })}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-brand-dark/60 text-xs">
                      {item.source === "pos" && item.paymentMethod
                        ? <span className="px-2 py-0.5 rounded-full bg-brand-muted text-brand-dark/70">{item.paymentMethod}</span>
                        : item.notes || `${item.itemCount} ítem${item.itemCount !== 1 ? "s" : ""}`
                      }
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-dark">
                      ₡{item.total.toLocaleString("es-CR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.paid ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"
                      }`}>
                        {item.paid ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {item.source === "pos" && (
                          <>
                            <button
                              onClick={() => handleDownloadPdf(item)}
                              title="Descargar PDF"
                              className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/40 hover:text-blue-500 transition-colors cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleThermalReprint(item)}
                              disabled={printStates[item.id] === "checking" || printStates[item.id] === "printing"}
                              title="Reimprimir en térmica"
                              className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/40 hover:text-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {printStates[item.id] === "checking" || printStates[item.id] === "printing" ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : printStates[item.id] === "success" ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : printStates[item.id] === "error" ? (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <Printer className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => openSaleEdit(item.id)}
                              title="Editar venta"
                              className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/40 hover:text-brand-pink transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <Button size="icon-sm" variant="destructive" onClick={() => openDeleteSale(item)} title="Eliminar venta" aria-label="Eliminar venta">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {item.source === "manual" && (
                          <>
                            {!item.paid && (
                              <button
                                onClick={() => togglePaid(item.id, true)}
                                title="Marcar como pagado"
                                className="p-1.5 rounded-lg hover:bg-emerald-50 text-brand-dark/40 hover:text-emerald-600 transition-colors cursor-pointer"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditOrder({ _id: item.id, customerName: item.customerName, phone: item.phone ?? "", items: [], total: item.total, paid: item.paid, orderedAt: new Date(item.date), notes: item.notes, createdAt: new Date(), updatedAt: new Date(), tenantId: "" } as OrderRow);
                              }}
                              title="Editar pedido"
                              className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/40 hover:text-brand-pink transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <Button size="icon-sm" variant="destructive" onClick={() => setConfirmDelete(item.id)} title="Eliminar pedido" aria-label="Eliminar pedido">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {display.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-brand-dark/40">
                      {search
                        ? "Sin resultados para esa búsqueda."
                        : "No hay ventas ni pedidos en este período."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={(s) => { setPageSize(s); setPage(1); }}
            totalItems={filtered.length}
          />
        </div>
      )}

      {/* New Order Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4"><DialogTitle>Registrar pedido</DialogTitle></DialogHeader>
          <div className="px-6 pb-6">
            <OrderForm onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={!!editOrder} onOpenChange={(v) => !v && setEditOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4"><DialogTitle>Editar pedido</DialogTitle></DialogHeader>
          <div className="px-6 pb-6">
            {editOrder && (
              <OrderForm
                key={editOrder._id}
                initial={{
                  customerName: editOrder.customerName,
                  phone:        editOrder.phone,
                  items:        editOrder.items,
                  total:        editOrder.total,
                  paid:         editOrder.paid,
                  orderedAt:    editOrder.orderedAt,
                  notes:        editOrder.notes,
                }}
                onSave={handleEditSave}
                onCancel={() => setEditOrder(null)}
                saving={saving}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit POS Sale Dialog ── */}
      <Dialog open={!!editSale} onOpenChange={(v) => !v && setEditSale(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto px-6">
          <DialogHeader className="pb-3">
            <DialogTitle>Editar venta POS</DialogTitle>
          </DialogHeader>
          {editSale && (() => {
            // Mismo cálculo que hace el servidor al guardar: cobros y envío de la venta original.
            const t = computeSaleTotals({
              subtotal: subtotalOf(editSale.items),
              charges: {
                ivaEnabled: editSale.ivaEnabled, ivaRate: editSale.ivaRate,
                serviceEnabled: editSale.serviceEnabled, serviceRate: editSale.serviceRate,
                tipEnabled: editSale.tipEnabled,
              },
              orderType: isOrderType(editSale.orderType) ? editSale.orderType : "LOCAL",
              tipAmount: editSale.tipAmount,
              deliveryFee: editSale.deliveryFee,
            });
            const { subtotal, total } = t;
            const ivaAmt = t.ivaAmount, svcAmt = t.serviceAmount, tipAmt = t.tipAmount;
            const filteredProducts = saleProducts
              .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
              .slice(0, 8);

            return (
              <div className="space-y-4 px-3 pb-4">
                {/* Cliente y encargado */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">Cliente</label>
                    <input type="text" value={editSale.customerName}
                      onChange={(e) => setEditSale({ ...editSale, customerName: e.target.value })}
                      placeholder="Nombre del cliente"
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">Mesa</label>
                    <input type="text" value={editSale.tableNumber}
                      onChange={(e) => setEditSale({ ...editSale, tableNumber: e.target.value })}
                      placeholder="Mesa o —"
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink" />
                  </div>
                </div>
                <p className="text-xs text-brand-dark/50">
                  Atendió: <span className="font-medium text-brand-dark">{editSale.cashUserName || "—"}</span>
                </p>

                {/* Observaciones */}
                <div>
                  <label className="block text-xs font-medium text-brand-dark/60 mb-1">Observaciones</label>
                  <textarea
                    value={editSale.notes ?? ""}
                    onChange={(e) => setEditSale({ ...editSale, notes: e.target.value })}
                    placeholder="Observaciones sobre esta venta (opcional)"
                    rows={2}
                    className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
                  />
                </div>

                {/* Productos */}
                <div>
                  <label className="block text-xs font-medium text-brand-dark/60 mb-2">Productos</label>
                  <div className="space-y-2 mb-2">
                    {editSale.items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <span className="flex-1 text-sm font-medium text-gray-900 truncate">{item.productName}</span>
                        <span className="text-xs text-gray-400">{fmt(item.unitPrice)}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateSaleItem(item.productId, -1)}
                            className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                          <button type="button" onClick={() => updateSaleItem(item.productId, 1)}
                            className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-brand-pink w-20 text-right">{fmt(lineTotal(item))}</span>
                        <Button type="button" size="icon-xs" variant="destructive" className="shrink-0"
                          title="Quitar producto" aria-label="Quitar producto"
                          onClick={() => updateSaleItem(item.productId, -item.quantity)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {/* Agregar producto */}
                  <div className="relative" ref={productSearchRef}>
                    <div className="flex items-center gap-2 border border-brand-muted rounded-xl px-3 py-2 focus-within:border-brand-pink">
                      <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <input type="text" value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setShowProductDrop(true); }}
                        onFocus={() => setShowProductDrop(true)}
                        placeholder="Buscar producto para agregar..."
                        className="flex-1 text-sm focus:outline-none bg-transparent" />
                    </div>
                    {showProductDrop && productSearch && (
                      <div className="absolute top-full mt-1 inset-x-0 bg-white border border-brand-muted rounded-xl shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <p className="text-xs text-gray-400 px-3 py-2">Sin resultados</p>
                        ) : filteredProducts.map((p) => (
                          <button key={p._id} type="button" onClick={() => addSaleProduct(p)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-brand-muted/20 text-left">
                            <span>{p.name}</span>
                            <span className="text-brand-pink font-semibold">{fmt(p.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Método de pago */}
                <div>
                  <label className="block text-xs font-medium text-brand-dark/60 mb-2">Método de pago</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["efectivo", "sinpe", "tarjeta", "mixto"] as const).map((m) => (
                      <button key={m} type="button"
                        onClick={() => setEditSale({ ...editSale, paymentMethod: m })}
                        className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${editSale.paymentMethod === m ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/40"}`}>
                        {m === "efectivo" ? "💵 Efectivo" : m === "sinpe" ? "📱 SINPE" : m === "tarjeta" ? "💳 Tarjeta" : "🔀 Mixto"}
                      </button>
                    ))}
                  </div>
                  {editSale.paymentMethod === "mixto" && (
                    <div className="mt-3 space-y-2">
                      {(["efectivo", "sinpe", "tarjeta"] as const).map((m) => (
                        <div key={m} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-20 shrink-0">{m === "efectivo" ? "💵 Efectivo" : m === "sinpe" ? "📱 SINPE" : "💳 Tarjeta"}</span>
                          <input type="number" min={0} value={editSale.mixedPayment[m]}
                            onChange={(e) => setEditSale({ ...editSale, mixedPayment: { ...editSale.mixedPayment, [m]: Number(e.target.value) } })}
                            className="flex-1 text-right border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-brand-pink" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totales */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                  {ivaAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">IVA ({editSale.ivaRate}%)</span><span>{fmt(ivaAmt)}</span></div>}
                  {svcAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Servicio ({editSale.serviceRate}%)</span><span>{fmt(svcAmt)}</span></div>}
                  {tipAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Propina</span><span>{fmt(tipAmt)}</span></div>}
                  {t.deliveryFee > 0 && <div className="flex justify-between"><span className="text-gray-500">Envío</span><span>{fmt(t.deliveryFee)}</span></div>}
                  <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1.5"><span>Total</span><span className="text-brand-pink">{fmt(total)}</span></div>
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-1">
                  <Button variant="cancel" className="flex-1" onClick={() => setEditSale(null)}>Cancelar</Button>
                  <Button className="flex-1" disabled={savingSale || editSale.items.length === 0} onClick={handleSaleSave}>
                    {savingSale && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    Guardar cambios
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2"><DialogTitle>¿Eliminar pedido?</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-brand-dark/60">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button variant="destructive" className="flex-1"
                onClick={() => confirmDelete && handleDelete(confirmDelete)}>Eliminar</Button>
              <Button variant="cancel" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete POS Sale */}
      <Dialog open={!!confirmDeleteSale} onOpenChange={(v) => !v && closeDeleteSale()}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2"><DialogTitle>¿Eliminar venta?</DialogTitle></DialogHeader>
          {confirmDeleteSale && (
            <div className="px-6 pb-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tiquete</span>
                  <span className="font-semibold">#{confirmDeleteSale.ticketNumber ?? confirmDeleteSale.id.slice(-6).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold">{fmt(confirmDeleteSale.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha</span>
                  <span>
                    {new Date(confirmDeleteSale.date).toLocaleDateString("es-CR", { day: "2-digit", month: "short" })}
                    {" "}
                    {new Date(confirmDeleteSale.date).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-red-600">
                Esta acción no se puede deshacer: devuelve el inventario y, si venía de una mesa, reabre lo que quedó pendiente.
              </p>
              {!isToday(confirmDeleteSale.date) && (
                <p className="text-sm text-orange-600">
                  Esta venta no es de hoy: eliminarla puede afectar un cierre de caja ya realizado.
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-brand-dark/60 mb-1">Contraseña de eliminación</label>
                <input
                  type="password"
                  autoFocus
                  value={deleteSalePassword}
                  onChange={(e) => setDeleteSalePassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && deleteSalePassword) handleDeleteSale(); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
              {deleteSaleError && <p className="text-sm text-red-600">{deleteSaleError}</p>}
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deletingSale || !deleteSalePassword}
                  onClick={handleDeleteSale}
                >
                  {deletingSale && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  Eliminar
                </Button>
                <Button variant="cancel" className="flex-1" onClick={closeDeleteSale}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
