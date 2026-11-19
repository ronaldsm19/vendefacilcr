"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Loader2, Plus, Minus, X, Check, ShoppingCart, Printer, UserCircle,
  Utensils, ChevronLeft, RefreshCw, AlertCircle, FileText, Search, ScanBarcode,
} from "lucide-react";
import { sameBarcode } from "@/lib/barcode";
import { useBarcodeScanner } from "@/lib/useBarcodeScanner";
import { Button } from "@/components/ui/button";
import { saleTicket, DEFAULT_TICKET_CONFIG, type SaleTicketData, type TicketConfigData } from "@/lib/ticket";
import { buildSalePayload, checkAgent, printReceipt } from "@/lib/printBridge";
import WeighDialog from "@/components/admin/WeighDialog";
import OpenPriceDialog from "@/components/admin/OpenPriceDialog";
import { catalogPriceLabel, weightDetail } from "@/lib/soldBy";
import ThermalPrintButton from "@/components/admin/ThermalPrintButton";
import AddToComandaPanel from "@/components/admin/AddToComandaPanel";
import { useAdminSession } from "@/components/admin/SessionContext";
import PendingComandasBanner from "@/components/admin/PendingComandasBanner";
import InvoiceCustomerPicker from "@/components/admin/InvoiceCustomerPicker";
import { can, planAllows } from "@/lib/permissions";
import type { CustomerView } from "@/lib/customerId";
import PaymentMethodPicker, { PaymentMethodChip, PAYMENT_METHOD_ICONS } from "@/components/admin/PaymentMethodPicker";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_STYLE, SPLIT_METHODS, type PaymentMethod } from "@/lib/payments";
import { notifyComandasUpdated } from "@/components/admin/PendingComandasContext";
import { DEFAULT_COMANDA_CONFIG, readComandaConfig, type ComandaConfigData } from "@/lib/comandaConfig";
import { badgeLevel, type BadgeLevel } from "@/lib/comandaTime";
import { orderCategories, type CategoryOrderEntry } from "@/lib/categories";
import {
  categorySectionMap, readSections, sectionOfCategory, visibleSections, type BusinessSection,
} from "@/lib/sections";
import {
  computeSaleTotals, readPosCharges, subtotalOf, lineTotal, effectiveUnitPrice, extrasKey, extraLabel, extraQty, appliesService,
  DEFAULT_POS_CHARGES, type OrderType, type PosCharges, type SaleTotals, type LineExtra, type AppliedCharges,
} from "@/lib/pricing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  _id: string;
  name: string;
  price: number;
  image?: string;
  category: string;
  available: boolean;
  extras?: LineExtra[];
  barcode?: string;
  soldBy?: "unidad" | "kg" | "libre";
}

interface CartLine {
  productId: string;
  productName: string;
  unitPrice: number;      // precio base; los extras van aparte y el total sale de lineTotal()
  quantity: number;
  extras?: LineExtra[];
  /** Pieza de un producto por kilo: su peso (unitPrice es el precio del kilo). */
  weightKg?: number;
  /** Pieza de un producto de precio libre: unitPrice es el que escribió el cajero. */
  openPrice?: boolean;
  // Solo en líneas que vienen de una comanda (bloqueadas)
  comandaId?: string;
  comandaNumber?: number;
  itemIndex?: number;
  note?: string;
}

/** Mismo producto con extras distintos (o piezas de distinto peso o precio) = líneas distintas. */
function lineKey(l: CartLine) {
  return l.comandaId ? `${l.comandaId}:${l.itemIndex}` : `${l.productId}|${l.weightKg ?? ""}|${l.unitPrice}|${extrasKey(l.extras)}`;
}

/** Extras de una línea, cada uno con su precio, debajo del nombre del producto. */
function LineExtras({ extras, className = "" }: { extras?: LineExtra[]; className?: string }) {
  if (!extras?.length) return null;
  // Spans (no <ul>): también se usa dentro de <label>.
  return (
    <span className={`block text-xs text-gray-500 ${className}`}>
      {extras.map((e) => (
        <span key={e.name} className="block">+ {extraLabel(e)} {e.price > 0 ? fmt(e.price * extraQty(e)) : "(sin costo)"}</span>
      ))}
    </span>
  );
}

interface ComandaSelection {
  comandaId: string;
  number: number;
  version: number;
  items: { index: number; qty: number }[];
}

interface OpenComandaItem {
  index: number; productId: string; productName: string; unitPrice: number;
  quantity: number; paidQty: number; pendingQty: number; note: string; station: string;
  extras?: LineExtra[];
  weightKg?: number;
}
interface OpenComanda {
  _id: string; number: number; status: "enviada" | "servida"; version: number;
  customerName: string; waiterName: string; sentAt: string; servedAt: string | null;
  notes: string; isPrevious: boolean; pendingTotal: number; items: OpenComandaItem[];
}
interface OpenTable {
  tableId: string; tableLabel: string; tableShape: string; areaId: string; areaName: string;
  tableStatus: string | null; openCount: number; pendingTotal: number;
  oldestSentAt: string; minutes: number; comandas: OpenComanda[];
}

function defaultPicks(t: OpenTable) {
  const p: Record<string, number> = {};
  for (const c of t.comandas) if (!c.isPrevious)
    for (const it of c.items) if (it.pendingQty > 0) p[`${c._id}:${it.index}`] = it.pendingQty;
  return p;
}

/** Cuántas líneas de ítem (no unidades) siguen con algo pendiente en la mesa. */
function pendingItemCount(t: OpenTable): number {
  let n = 0;
  for (const c of t.comandas) for (const it of c.items) if (it.pendingQty > 0) n++;
  return n;
}

const MIN_TEXT: Record<BadgeLevel, string> = { ok: "text-emerald-600", warn: "text-amber-600", alert: "text-red-600" };

interface TableGroup {
  area: string;
  tables: { value: string; label: string }[];
}

// Dropdown of the real Salón tables, grouped by zone. Source of truth = Salón (not a manual count).
function TableSelect({ tableGroups, value, onChange, className }: {
  tableGroups: TableGroup[];
  value: string;
  onChange: (v: string) => void;
  className: string;
}) {
  if (tableGroups.length === 0) return null;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">Sin mesa</option>
      {tableGroups.map((g) => (
        <optgroup key={g.area} label={g.area}>
          {g.tables.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onClick,
}: {
  product: ProductRow;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all text-left overflow-hidden flex flex-col"
    >
      {product.image ? (
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] flex items-center justify-center bg-gray-50 text-3xl text-gray-200">
          🛒
        </div>
      )}
      <div className="p-3">
        <p className="font-bold text-base text-gray-900 leading-tight line-clamp-2">{product.name}</p>
        <p className="text-sm font-semibold text-brand-pink mt-1">{catalogPriceLabel(product.price, product.soldBy)}</p>
      </div>
    </button>
  );
}

// ── Cobros de la venta ────────────────────────────────────────────────────────
// Configuración → Caja decide qué cobros tiene el negocio y su porcentaje. Acá aparecen solo esos,
// con un switch para aplicarlos o no en ESTA venta; el porcentaje no se cambia desde el POS.

const APPLY_ALL: Required<AppliedCharges> = { iva: true, service: true, tip: true };

// ── Puntos de venta (pestañas): cada pestaña es una venta en proceso independiente ──
// Fase 1: locales por terminal (se guardan en localStorage, sin servidor). Solo Premium.
const MAX_TABS = 6;
let tabSeqCounter = 0;
function newTabId() { return `t${Date.now().toString(36)}${(tabSeqCounter++).toString(36)}`; }

/** Todo el estado de UNA venta en proceso, para poder guardarla/restaurarla al cambiar de pestaña. */
interface SaleDraft {
  cart: CartLine[];
  tipAmount: number;
  customerName: string;
  tableNumber: string;
  observaciones: string;
  paymentMethod: PaymentMethod;
  mixedAmounts: { efectivo: number; sinpe: number; tarjeta: number };
  orderType: OrderType;
  pickupTime: string;
  deliveryAddress: string;
  deliveryPhone: string;
  deliveryFee: number;
  tableId: string;
  comandaSelections: ComandaSelection[];
  isPartialCharge: boolean;
  applied: Required<AppliedCharges>;
}

function emptyDraft(): SaleDraft {
  return {
    cart: [], tipAmount: 0, customerName: "", tableNumber: "", observaciones: "",
    paymentMethod: "efectivo", mixedAmounts: { efectivo: 0, sinpe: 0, tarjeta: 0 },
    orderType: "LOCAL", pickupTime: "", deliveryAddress: "", deliveryPhone: "", deliveryFee: 0,
    tableId: "", comandaSelections: [], isPartialCharge: false, applied: { ...APPLY_ALL },
  };
}

function ChargeSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink ${
        checked ? "bg-brand-pink" : "bg-gray-300"
      }`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function ChargeLines({
  charges,
  orderType,
  applied,
  onAppliedChange,
  totals,
  tipAmount,
  onTipChange,
  tipInputClassName,
}: {
  charges: PosCharges;
  orderType: OrderType;
  applied: Required<AppliedCharges>;
  onAppliedChange: (next: Required<AppliedCharges>) => void;
  totals: SaleTotals;
  tipAmount: number;
  onTipChange: (n: number) => void;
  tipInputClassName: string;
}) {
  const row = (on: boolean) => `text-sm ${on ? "text-brand-dark/70" : "text-gray-300"}`;
  return (
    <>
      {charges.ivaEnabled && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChargeSwitch checked={applied.iva} onChange={(v) => onAppliedChange({ ...applied, iva: v })} label={`Cobrar IVA ${charges.ivaRate}% en esta venta`} />
            <span className={row(applied.iva)}>IVA ({charges.ivaRate}%)</span>
          </div>
          <span className={`text-sm font-semibold ${applied.iva ? "" : "text-gray-300"}`}>{fmt(totals.ivaAmount)}</span>
        </div>
      )}
      {appliesService(charges, orderType) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChargeSwitch checked={applied.service} onChange={(v) => onAppliedChange({ ...applied, service: v })} label={`Cobrar servicio ${charges.serviceRate}% en esta venta`} />
            <span className={row(applied.service)}>Servicio ({charges.serviceRate}%)</span>
          </div>
          <span className={`text-sm font-semibold ${applied.service ? "" : "text-gray-300"}`}>{fmt(totals.serviceAmount)}</span>
        </div>
      )}
      {charges.tipEnabled && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChargeSwitch checked={applied.tip} onChange={(v) => onAppliedChange({ ...applied, tip: v })} label="Cobrar propina en esta venta" />
            <span className={row(applied.tip)}>Propina</span>
          </div>
          {applied.tip ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">₡</span>
              <input
                type="number"
                min={0}
                value={tipAmount || ""}
                placeholder="0"
                aria-label="Monto de la propina"
                onChange={(e) => onTipChange(Math.max(0, Number(e.target.value)))}
                className={tipInputClassName}
              />
            </div>
          ) : (
            <span className="text-sm font-semibold text-gray-300">{fmt(0)}</span>
          )}
        </div>
      )}
    </>
  );
}

// ── Shared order-type segmented control ───────────────────────────────────────

function OrderTypeSelector({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (t: OrderType) => void;
}) {
  return (
    <div className="flex rounded-xl border border-gray-200 overflow-hidden">
      {(["LOCAL", "PICKUP", "EXPRESS"] as const).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
            value === type
              ? "bg-brand-pink text-white"
              : "text-brand-dark/50 hover:bg-brand-pink/5 bg-white"
          }`}
        >
          {type === "LOCAL" ? "🍽 Local" : type === "PICKUP" ? "🥡 Pickup" : "🛵 Express"}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-pink" /></div>}>
      <PosPageInner />
    </Suspense>
  );
}

function PosPageInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = pathname.split("/")[1];
  const DRAFT_KEY = `pos_cart_${tenantSlug}`;
  const session = useAdminSession();
  const { isPremium } = session;
  const canInvoice = can(session, "clientes") && planAllows(session, "clientes");

  // ── Data state ──────────────────────────────────────────────────
  const [products, setProducts]       = useState<ProductRow[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<CategoryOrderEntry[]>([]);
  const [sections, setSections]       = useState<BusinessSection[]>([]);
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [ticketConfig, setTicketConfig] = useState<TicketConfigData>(DEFAULT_TICKET_CONFIG);
  const [loading, setLoading]         = useState(true);

  // ── Catalog state ────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState("todos");
  // Sección del negocio que se está mostrando ("todas" = sin filtro). Se recuerda por equipo: la
  // caja del mostrador de la tienda puede quedarse siempre en su sección.
  const [activeSection, setActiveSection]   = useState("todas");
  const [qtyModal, setQtyModal]             = useState<ProductRow | null>(null);
  // Producto por kilo que se está pesando antes de agregarlo.
  const [weighing, setWeighing]             = useState<ProductRow | null>(null);
  const [pricing, setPricing]               = useState<ProductRow | null>(null);
  const [qtyInput, setQtyInput]             = useState(1);
  const [qtyExtras, setQtyExtras]           = useState<string[]>([]);   // extras elegidos en el modal
  // Buscador del catálogo: por nombre o por código (también recibe lo que manda el lector).
  const [productSearch, setProductSearch]   = useState("");
  // Aviso corto de lo que pasó al escanear ("Agregado: …" o "No hay ningún producto con …").
  const [scanNotice, setScanNotice]         = useState<{ ok: boolean; text: string } | null>(null);
  const scanNoticeTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cart state ───────────────────────────────────────────────────
  const [cart, setCart]             = useState<CartLine[]>([]);
  const [tipAmount, setTipAmount]   = useState(0);
  const [customerName, setCustomerName] = useState("");
  // Cliente del registro a cuyo nombre sale la factura (comprobante por correo). No va en el
  // borrador del carrito: se elige al cobrar.
  const [invoiceCustomer, setInvoiceCustomer] = useState<CustomerView | null>(null);
  const [invoiceSentTo, setInvoiceSentTo] = useState<string | null>(null);
  const [tableNumber, setTableNumber]   = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [showMixedModal, setShowMixedModal] = useState(false);
  const [mixedAmounts, setMixedAmounts]     = useState({ efectivo: 0, sinpe: 0, tarjeta: 0 });
  const [showCartPanel, setShowCartPanel]   = useState(false);

  // ── Order type state ─────────────────────────────────────────────
  const [orderType, setOrderType]           = useState<OrderType>("LOCAL");
  const [pickupTime, setPickupTime]         = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone]   = useState("");
  const [deliveryFee, setDeliveryFee]       = useState(0);

  // ── Mesas / comandas state ─────────────────────────────────────────
  const [tableId, setTableId] = useState("");                       // _id de SalonTable
  const [comandaSelections, setComandaSelections] = useState<ComandaSelection[]>([]);
  const [saleError, setSaleError] = useState<{ message: string; code?: string } | null>(null);
  const [showTablesPanel, setShowTablesPanel] = useState(false);
  const [openTables, setOpenTables] = useState<OpenTable[]>([]);
  const [tablesMultiArea, setTablesMultiArea] = useState(false);
  const [thresholds, setThresholds] = useState<ComandaConfigData>(DEFAULT_COMANDA_CONFIG);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [activeTable, setActiveTable] = useState<OpenTable | null>(null);   // null = lista
  // selección dentro del panel: clave `${comandaId}:${index}` → qty elegida
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  // Comanda a la que se le está agregando lo que faltó anotar (tercer paso del panel), y el aviso de lo agregado.
  const [addingTo, setAddingTo] = useState<OpenComanda | null>(null);
  const [panelAdded, setPanelAdded] = useState<string | null>(null);
  const [lastTableNote, setLastTableNote] = useState<string | null>(null);
  const [isPartialCharge, setIsPartialCharge] = useState(false);
  const [nextTableToCharge, setNextTableToCharge] = useState<OpenTable | null>(null);

  // ── Sale state ───────────────────────────────────────────────────
  const [saving, setSaving]           = useState(false);
  const [lastSaleNum, setLastSaleNum] = useState<string | null>(null);
  const [lastSaleTicket, setLastSaleTicket] = useState<SaleTicketData | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoPrintError, setAutoPrintError] = useState<string | null>(null);
  const autoPrintedSaleIds = useRef<Set<string>>(new Set());

  // ── Payment modal state ──────────────────────────────────────────
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amountPaid, setAmountPaid]             = useState(0);
  const payAmountRef = useRef<HTMLInputElement>(null);

  // ── Cobros del negocio (Configuración → Caja): cuáles hay y su porcentaje ──
  const [charges, setCharges] = useState<PosCharges>(DEFAULT_POS_CHARGES);
  // ── Si se aplican en ESTA venta (switch del cajero); arrancan prendidos en cada venta ──
  const [applied, setApplied] = useState<Required<AppliedCharges>>(APPLY_ALL);

  // Flag: solo persistir DESPUÉS de que el draft haya sido restaurado
  const [draftLoaded, setDraftLoaded] = useState(false);

  // ── Pestañas (puntos de venta abiertos a la vez) — solo Premium ──
  // `tabIds` es el orden visible; `activeTabId` la pestaña activa (su estado es el de arriba, en vivo).
  // Las pestañas NO activas guardan su venta en `parkedDrafts` (ref: no necesita re-render al aparcar).
  const [tabIds, setTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const parkedDrafts = useRef<Record<string, SaleDraft>>({});

  /** Lee el estado de la venta activa (lo de "arriba") como un SaleDraft. */
  function snapshotDraft(): SaleDraft {
    return {
      cart, tipAmount, customerName, tableNumber, observaciones, paymentMethod,
      mixedAmounts, orderType, pickupTime, deliveryAddress, deliveryPhone, deliveryFee,
      tableId, comandaSelections, isPartialCharge, applied,
    };
  }

  /** Vuelca un SaleDraft a los estados de la venta activa (al cambiar de pestaña). */
  function restoreDraft(d: SaleDraft) {
    setCart(d.cart ?? []);
    setTipAmount(d.tipAmount ?? 0);
    setCustomerName(d.customerName ?? "");
    setTableNumber(d.tableNumber ?? "");
    setObservaciones(d.observaciones ?? "");
    setPaymentMethod(d.paymentMethod ?? "efectivo");
    setMixedAmounts(d.mixedAmounts ?? { efectivo: 0, sinpe: 0, tarjeta: 0 });
    setOrderType(d.orderType ?? "LOCAL");
    setPickupTime(d.pickupTime ?? "");
    setDeliveryAddress(d.deliveryAddress ?? "");
    setDeliveryPhone(d.deliveryPhone ?? "");
    setDeliveryFee(d.deliveryFee ?? 0);
    setTableId(d.tableId ?? "");
    setComandaSelections(d.comandaSelections ?? []);
    setIsPartialCharge(d.isPartialCharge ?? false);
    setApplied(d.applied ? { iva: d.applied.iva !== false, service: d.applied.service !== false, tip: d.applied.tip !== false } : { ...APPLY_ALL });
  }

  /** Limpia avisos/paneles transitorios al cambiar o abrir pestaña (no son parte de la venta). */
  function clearTransientUI() {
    setSaleError(null);
    setShowSuccess(false);
    setLastTableNote(null);
    setNextTableToCharge(null);
    setShowCartPanel(false);
    setInvoiceCustomer(null);
    setInvoiceSentTo(null);
  }

  /** Cambia a otra pestaña: aparca la actual y restaura la destino. */
  function switchTab(toId: string) {
    if (toId === activeTabId) return;
    if (!tabIds.includes(toId)) return;
    parkedDrafts.current[activeTabId] = snapshotDraft();
    const d = parkedDrafts.current[toId] ?? emptyDraft();
    delete parkedDrafts.current[toId];
    restoreDraft(d);
    clearTransientUI();
    setActiveTabId(toId);
  }

  /** Abre una nueva pestaña (cuenta vacía), aparcando la actual. */
  function newTab() {
    if (tabIds.length >= MAX_TABS) {
      setSaleError({ message: `Máximo ${MAX_TABS} cuentas abiertas a la vez. Cerrá una para abrir otra.` });
      return;
    }
    parkedDrafts.current[activeTabId] = snapshotDraft();
    restoreDraft(emptyDraft());
    clearTransientUI();
    const id = newTabId();
    setTabIds((prev) => [...prev, id]);
    setActiveTabId(id);
  }

  /** Cierra una pestaña. Si tiene ítems pide confirmación. Siempre queda al menos una. */
  function closeTab(id: string) {
    if (tabIds.length <= 1) return;
    const draft = id === activeTabId ? snapshotDraft() : parkedDrafts.current[id];
    if (draft && draft.cart.length > 0 && !window.confirm("Esta cuenta tiene productos sin cobrar. ¿Cerrarla y perder su avance?")) return;
    const idx = tabIds.indexOf(id);
    const remaining = tabIds.filter((x) => x !== id);
    if (id === activeTabId) {
      const neighbor = remaining[Math.min(idx, remaining.length - 1)];
      const d = parkedDrafts.current[neighbor] ?? emptyDraft();
      delete parkedDrafts.current[neighbor];
      restoreDraft(d);
      clearTransientUI();
      setActiveTabId(neighbor);
    }
    delete parkedDrafts.current[id];
    setTabIds(remaining);
  }

  /** Etiqueta/metadata de una pestaña para la barra (de su draft activo o aparcado). */
  function tabInfo(id: string): { name: string; isMesa: boolean; count: number } {
    const d = id === activeTabId ? snapshotDraft() : (parkedDrafts.current[id] ?? emptyDraft());
    const isMesa = Boolean(d.tableId) || Boolean(d.tableNumber.trim());
    const name = d.tableNumber.trim() || "Mostrador";
    const count = d.cart.reduce((s, l) => s + l.quantity, 0);
    return { name, isMesa, count };
  }

  // ── Persist draft cart (carrito, datos del pedido y qué cobros aplica esta venta; los porcentajes vienen siempre de la configuración) ─
  useEffect(() => {
    if (!draftLoaded || !tenantSlug || !activeTabId) return;
    const active = snapshotDraft();
    const parked = isPremium ? parkedDrafts.current : {};
    const ids = tabIds.length ? tabIds : [activeTabId];
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 2, tabIds: ids, activeTabId, parked, active }));
    window.dispatchEvent(new CustomEvent("pos-cart-update"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, paymentMethod, tipAmount, orderType, draftLoaded, tableId, tableNumber, customerName,
      observaciones, mixedAmounts, pickupTime, deliveryAddress, deliveryPhone, deliveryFee,
      isPartialCharge, comandaSelections, applied, tabIds, activeTabId]);

  async function loadOpenTables(focusTableId?: string): Promise<OpenTable[]> {
    setTablesLoading(true);
    try {
      const res = await fetch("/api/admin/comandas/open-by-table");
      if (!res.ok) { setOpenTables([]); return []; }
      const data = await res.json();
      const tables: OpenTable[] = data.tables ?? [];
      setOpenTables(tables);
      setTablesMultiArea(Boolean(data.multiArea));
      setThresholds(readComandaConfig(data));
      if (focusTableId) {
        const t = tables.find((x) => x.tableId === focusTableId) ?? null;
        setActiveTable(t);
        setPicked(t ? defaultPicks(t) : {});
        if (!t) setPanelNotice("La mesa ya no tiene comandas abiertas.");
      }
      return tables;
    } finally {
      setTablesLoading(false);
    }
  }

  // ── Load data ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try { localStorage.removeItem("pos_cashUser"); } catch {}
      const [productsRes, categoriesRes, configRes, meRes, areasRes, salonTablesRes] = await Promise.all([
        fetch("/api/admin/products").then((r) => r.json()),
        fetch("/api/admin/categories").then((r) => r.json()).catch(() => ({})),
        fetch("/api/admin/pos-config").then((r) => r.json()),
        fetch("/api/admin/auth/me").then((r) => r.json()).catch(() => ({})),
        fetch("/api/admin/salon/areas").then((r) => r.json()).catch(() => ({})),
        fetch("/api/admin/salon/tables").then((r) => r.json()).catch(() => ({})),
      ]);
      setProducts((productsRes.products ?? []).filter((p: ProductRow) => p.available));
      setCategoryOrder(categoriesRes.categories ?? []);
      setSections(readSections(categoriesRes.sections));
      try {
        const savedSection = localStorage.getItem("pos_section");
        if (savedSection) setActiveSection(savedSection);
      } catch {}
      // `||` (no `??`): si tenantName viene como cadena vacía, igual caemos al
      // slug del tenant, para que el nombre del negocio nunca vaya vacío (el
      // agente de impresión lo exige como obligatorio).
      setBusinessName(meRes.tenantName || tenantSlug);
      if (meRes.ticketConfig) setTicketConfig({ ...DEFAULT_TICKET_CONFIG, ...meRes.ticketConfig });
      setCharges(readPosCharges(configRes));

      // Mesas reales del Salón → dropdown del POS, agrupadas por zona
      const salonAreas: { _id: string; name: string; order?: number }[] = areasRes.areas ?? [];
      const salonTables: { _id: string; areaId: string; label: string; shape: string }[] = salonTablesRes.tables ?? [];
      const multiArea = salonAreas.length > 1;
      const groups: TableGroup[] = [...salonAreas]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => ({
          area: a.name,
          tables: salonTables
            .filter((t) => String(t.areaId) === String(a._id))
            .sort((t1, t2) => {
              const n1 = Number(t1.label), n2 = Number(t2.label);
              if (!isNaN(n1) && !isNaN(n2)) return n1 - n2;
              return String(t1.label).localeCompare(String(t2.label));
            })
            .map((t) => {
              const display = `${t.shape === "barstool" ? "Banqueta" : "Mesa"} ${t.label}`;
              return { value: multiArea ? `${a.name} · ${display}` : display, label: display };
            }),
        }))
        .filter((g) => g.tables.length > 0);
      setTableGroups(groups);
      // Restaurar borrador(es). v2 = varias pestañas; el formato viejo (un solo carrito) se migra
      // a una pestaña. Los cobros salen siempre de la configuración del negocio (se ignora ivaRate/serviceRate viejos).
      let bootIds: string[] = [];
      let bootActive = "";
      try {
        const raw = localStorage.getItem(`pos_cart_${pathname.split("/")[1]}`);
        const draft = raw ? JSON.parse(raw) : null;
        if (draft && draft.v === 2 && Array.isArray(draft.tabIds) && draft.tabIds.length) {
          // Formato nuevo: varias pestañas.
          let ids: string[] = draft.tabIds.filter((x: unknown) => typeof x === "string");
          const active = ids.includes(draft.activeTabId) ? draft.activeTabId : ids[0];
          const parked: Record<string, SaleDraft> = (draft.parked && typeof draft.parked === "object") ? draft.parked : {};
          if (!isPremium) { ids = [active]; parkedDrafts.current = {}; }   // sin Premium: una sola pestaña
          else {
            const clean: Record<string, SaleDraft> = {};
            for (const id of ids) if (id !== active && parked[id]) clean[id] = parked[id];
            parkedDrafts.current = clean;
          }
          restoreDraft((draft.active && typeof draft.active === "object") ? draft.active : emptyDraft());
          bootIds = ids; bootActive = active;
        } else if (draft && Array.isArray(draft.cart) && draft.cart.length > 0) {
          // Migración del formato viejo (un solo carrito) → una pestaña.
          restoreDraft({
            ...emptyDraft(),
            cart: draft.cart,
            paymentMethod: draft.paymentMethod ?? "efectivo",
            tipAmount: typeof draft.tipAmount === "number" ? draft.tipAmount : 0,
            orderType: draft.orderType ?? "LOCAL",
            tableId: typeof draft.tableId === "string" ? draft.tableId : "",
            tableNumber: typeof draft.tableNumber === "string" ? draft.tableNumber : "",
            customerName: typeof draft.customerName === "string" ? draft.customerName : "",
            comandaSelections: Array.isArray(draft.comandaSelections) ? draft.comandaSelections : [],
            applied: (draft.applied && typeof draft.applied === "object")
              ? { iva: draft.applied.iva !== false, service: draft.applied.service !== false, tip: draft.applied.tip !== false }
              : { ...APPLY_ALL },
          });
        }
      } catch { /* ignore */ }

      // Siempre debe existir al menos una pestaña.
      if (!bootIds.length) { bootActive = newTabId(); bootIds = [bootActive]; }
      setTabIds(bootIds);
      setActiveTabId(bootActive);
      setDraftLoaded(true);
      setLoading(false);
      if (isPremium) loadOpenTables();
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus payment input when modal opens
  useEffect(() => {
    if (showPaymentModal) {
      const timer = setTimeout(() => payAmountRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [showPaymentModal]);

  // Query param ?tableId= (viene de "Cobrar en POS" del historial de comandas)
  useEffect(() => {
    if (!draftLoaded) return;
    const qp = searchParams.get("tableId");
    if (!qp || !isPremium) return;
    (async () => {
      setOrderType("LOCAL");
      setShowTablesPanel(true);
      await loadOpenTables(qp);
      router.replace(pathname);   // quitar el param para que un refresh no reabra el panel
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded, isPremium]);

  // ── Derived ──────────────────────────────────────────────────────
  // Secciones del negocio: con dos o más que tengan productos aparece un filtro arriba de las
  // familias. Una sección guardada que ya no existe cae a "todas".
  const catSection = categorySectionMap(sections, categoryOrder);
  const sectionTabs = sections.length > 0
    ? visibleSections(sections, products.map((p) => sectionOfCategory(catSection, p.category)))
    : [];
  const showSectionTabs = sectionTabs.length >= 2;
  const currentSection = showSectionTabs && sectionTabs.some((s) => s.id === activeSection) ? activeSection : "todas";
  const sectionProducts = currentSection === "todas"
    ? products
    : products.filter((p) => sectionOfCategory(catSection, p.category) === currentSection);
  function selectSection(id: string) {
    setActiveSection(id);
    setActiveCategory("todos");
    try { localStorage.setItem("pos_section", id); } catch {}
  }

  const categories = ["todos", ...orderCategories(categoryOrder, sectionProducts.map((p) => p.category))];
  // Igual que la pantalla de comandas: agrupados en el orden de las familias (Configuración →
  // Productos) y, dentro de cada familia, por nombre.
  const categoryRank = new Map(categories.map((c, i) => [c, i]));
  // Con algo escrito en el buscador se busca en todo el catálogo, sin importar sección ni familia.
  const searchQuery = productSearch.trim().toLowerCase();
  const visibleProducts = (searchQuery
    ? products.filter((p) => p.name.toLowerCase().includes(searchQuery) || (p.barcode ?? "").toLowerCase().includes(searchQuery))
    : sectionProducts.filter((p) => activeCategory === "todos" || p.category === activeCategory))
    .sort((a, b) =>
      ((categoryRank.get(a.category) ?? categories.length) - (categoryRank.get(b.category) ?? categories.length)) ||
      a.name.localeCompare(b.name, "es")
    );

  // Misma fórmula que usa el servidor al guardar la venta (src/lib/pricing.ts).
  const totals       = computeSaleTotals({ subtotal: subtotalOf(cart), charges, orderType, tipAmount, deliveryFee, applied });
  const { subtotal, total } = totals;
  const mixedSum     = mixedAmounts.efectivo + mixedAmounts.sinpe + mixedAmounts.tarjeta;
  const mixedRemainder = total - mixedSum;
  const cashPortion    = paymentMethod === "efectivo" ? total : mixedAmounts.efectivo;
  const needsChangeCalc = paymentMethod === "efectivo" || (paymentMethod === "mixto" && mixedAmounts.efectivo > 0);
  const change         = amountPaid - cashPortion;

  // ── Handlers ─────────────────────────────────────────────────────
  function changeOrderType(type: OrderType) {
    if (type !== "LOCAL" && comandaSelections.length > 0) clearComandas();
    setOrderType(type);
    if (type !== "PICKUP")  setPickupTime("");
    if (type !== "EXPRESS") { setDeliveryAddress(""); setDeliveryPhone(""); setDeliveryFee(0); }
  }

  /** Elegir "mixto" abre de una el reparto, con todo puesto en efectivo como punto de partida. */
  function choosePaymentMethod(m: PaymentMethod) {
    setPaymentMethod(m);
    if (m === "mixto") {
      setMixedAmounts({ efectivo: total, sinpe: 0, tarjeta: 0 });
      setShowMixedModal(true);
    }
  }

  function openQtyModal(product: ProductRow) {
    // Un producto por kilo no lleva cantidad: se pesa la pieza.
    if (product.soldBy === "kg") { setWeighing(product); return; }
    // Uno de precio libre tampoco: se escribe el precio de la pieza.
    if (product.soldBy === "libre") { setPricing(product); return; }
    setQtyModal(product);
    setQtyInput(1);
    setQtyExtras([]);
  }

  // Extras elegidos en el modal, con el precio del catálogo en este momento (copia congelada).
  const qtyChosenExtras: LineExtra[] = (qtyModal?.extras ?? [])
    .filter((e) => qtyExtras.includes(e.name))
    .map((e) => ({ name: e.name, price: e.price }));

  function addToCart() {
    if (!qtyModal || qtyInput < 1) return;
    const newLine: CartLine = {
      productId:   qtyModal._id,
      productName: qtyModal.name,
      unitPrice:   qtyModal.price,
      quantity:    qtyInput,
      extras:      qtyChosenExtras,
    };
    const key = lineKey(newLine);
    setCart((prev) => {
      // Solo se suma a una línea existente si lleva exactamente los mismos extras.
      if (prev.some((l) => !l.comandaId && lineKey(l) === key)) {
        return prev.map((l) => (!l.comandaId && lineKey(l) === key ? { ...l, quantity: l.quantity + qtyInput } : l));
      }
      return [...prev, newLine];
    });
    setQtyModal(null);
  }

  /** La pieza pesada entra como 1 unidad con su peso; dos piezas del mismo peso se juntan. */
  function addWeighed(weightKg: number) {
    if (!weighing) return;
    const newLine: CartLine = {
      productId: weighing._id, productName: weighing.name, unitPrice: weighing.price, quantity: 1, extras: [], weightKg,
    };
    const key = lineKey(newLine);
    setCart((prev) =>
      prev.some((l) => !l.comandaId && lineKey(l) === key)
        ? prev.map((l) => (!l.comandaId && lineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, newLine]
    );
    setWeighing(null);
  }

  /** La pieza de precio libre entra como 1 unidad con su precio; dos al mismo precio se juntan. */
  function addOpenPriced(unitPrice: number) {
    if (!pricing) return;
    const newLine: CartLine = {
      productId: pricing._id, productName: pricing.name, unitPrice, quantity: 1, extras: [], openPrice: true,
    };
    const key = lineKey(newLine);
    setCart((prev) =>
      prev.some((l) => !l.comandaId && lineKey(l) === key)
        ? prev.map((l) => (!l.comandaId && lineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, newLine]
    );
    setPricing(null);
  }

  function showScanNotice(ok: boolean, text: string) {
    setScanNotice({ ok, text });
    if (scanNoticeTimer.current) clearTimeout(scanNoticeTimer.current);
    scanNoticeTimer.current = setTimeout(() => setScanNotice(null), ok ? 2000 : 4000);
  }

  /**
   * Lo que manda el lector de códigos: agrega una unidad del producto, sin extras (los extras se
   * eligen tocando la tarjeta). Devuelve si encontró el producto.
   */
  function addScannedProduct(code: string): boolean {
    const product = products.find((p) => sameBarcode(p.barcode, code.trim()));
    if (!product) {
      showScanNotice(false, `No hay ningún producto disponible con el código ${code.trim()}`);
      return false;
    }
    // Escanear un producto por kilo abre la báscula: falta saber cuánto pesa la pieza.
    if (product.soldBy === "kg") {
      setWeighing(product);
      return true;
    }
    // Y uno de precio libre pide el precio de la pieza.
    if (product.soldBy === "libre") {
      setPricing(product);
      return true;
    }
    const newLine: CartLine = {
      productId: product._id, productName: product.name, unitPrice: product.price, quantity: 1, extras: [],
    };
    const key = lineKey(newLine);
    setCart((prev) =>
      prev.some((l) => !l.comandaId && lineKey(l) === key)
        ? prev.map((l) => (!l.comandaId && lineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, newLine]
    );
    showScanNotice(true, `Agregado: ${product.name}`);
    return true;
  }

  // Con una ventana abierta (cobro, cantidad, comandas…) el lector no agrega nada por detrás.
  useBarcodeScanner((code) => {
    if (document.querySelector('[role="dialog"]')) return;
    addScannedProduct(code);
  }, { enabled: !loading });

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setProductSearch(""); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = productSearch.trim();
    if (!code) return;
    // Un código exacto (escaneado o escrito) va directo a la venta; si no, con un solo resultado
    // se abre ese producto como si se hubiera tocado su tarjeta.
    if (products.some((p) => sameBarcode(p.barcode, code))) {
      addScannedProduct(code);
      setProductSearch("");
    } else if (visibleProducts.length === 1) {
      openQtyModal(visibleProducts[0]);
      setProductSearch("");
    } else if (visibleProducts.length === 0) {
      showScanNotice(false, `No hay ningún producto disponible con "${code}"`);
    }
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (!l.comandaId && lineKey(l) === key) ? { ...l, quantity: l.quantity + delta } : l)
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.comandaId || lineKey(l) !== key));
  }

  function clearComandas() {
    setCart((prev) => prev.filter((l) => !l.comandaId));
    setComandaSelections([]);
    setTableId("");
    setSaleError(null);
    setIsPartialCharge(false);
  }

  /**
   * El servidor rechazó la venta porque algún precio del catálogo cambió desde que se abrió el POS:
   * recarga el catálogo y re-precia las líneas directas del carrito (las de comandas no se tocan,
   * esas se cobran a lo comandado). Lo que ya no existe se saca. El cajero revisa el total y cobra.
   */
  async function refreshCartPrices() {
    const res = await fetch("/api/admin/products");
    if (!res.ok) return;
    const all: ProductRow[] = (await res.json()).products ?? [];
    setProducts(all.filter((p) => p.available));
    const byId = new Map(all.map((p) => [p._id, p]));
    const merged = new Map<string, CartLine>();
    let dropped = 0;
    for (const l of cart) {
      let next: CartLine | null = l;
      if (!l.comandaId) {
        const p = byId.get(l.productId);
        if (!p || (p.soldBy === "kg") !== !!l.weightKg || (p.soldBy === "libre") !== !!l.openPrice) {
          // Ya no existe, o cambió cómo se vende (fijo, por kilo o libre): hay que volver a agregarlo.
          next = null;
        } else {
          const extras = (l.extras ?? []).flatMap((e) => {
            const c = p.extras?.find((x) => x.name === e.name);
            return c ? [{ name: c.name, price: c.price, qty: extraQty(e) }] : [];
          });
          if (extras.length !== (l.extras ?? []).length) dropped++;
          next = { ...l, productName: p.name, unitPrice: l.openPrice ? l.unitPrice : p.price, extras };
        }
      }
      if (!next) { dropped++; continue; }
      // Si al re-preciar dos líneas quedaron iguales, se juntan.
      const key = lineKey(next);
      const prev = merged.get(key);
      merged.set(key, prev ? { ...prev, quantity: prev.quantity + next.quantity } : next);
    }
    setCart(Array.from(merged.values()));
    setSaleError({
      message: dropped > 0
        ? "Precios actualizados. Algunos productos o extras ya no existen y se quitaron del pedido: revisalo antes de cobrar."
        : "Precios actualizados. Revisá el total antes de cobrar.",
      code: "PRICES_REFRESHED",
    });
  }

  function handleTableChange(v: string) {
    if (comandaSelections.length > 0) clearComandas();
    setTableNumber(v);
  }

  function applySelection() {
    if (!activeTable) return;
    const t = activeTable;
    const selections: ComandaSelection[] = [];
    const lines: CartLine[] = [];
    let selectedTotal = 0;
    let tablePendingTotal = 0;
    for (const c of t.comandas) {
      for (const it of c.items) tablePendingTotal += lineTotal({ ...it, quantity: it.pendingQty });
      const selItems = c.items
        .filter((it) => (picked[`${c._id}:${it.index}`] ?? 0) > 0)
        .map((it) => ({ index: it.index, qty: Math.min(picked[`${c._id}:${it.index}`], it.pendingQty) }));
      if (selItems.length === 0) continue;
      selections.push({ comandaId: c._id, number: c.number, version: c.version, items: selItems });
      for (const it of selItems) {
        const src = c.items[it.index];
        // La parte cobrada (total o parcial) lleva los mismos extras que la línea de la comanda.
        const line: CartLine = {
          productId: src.productId, productName: src.productName, unitPrice: src.unitPrice,
          quantity: it.qty, extras: src.extras ?? [],
          ...(src.weightKg ? { weightKg: src.weightKg } : {}),
          comandaId: c._id, comandaNumber: c.number, itemIndex: it.index, note: src.note,
        };
        selectedTotal += lineTotal(line);
        lines.push(line);
      }
    }
    if (selections.length === 0) return;
    const display = `${t.tableShape === "barstool" ? "Banqueta" : "Mesa"} ${t.tableLabel}`;
    setCart((prev) => [...prev.filter((l) => !l.comandaId), ...lines]);
    setComandaSelections(selections);
    setIsPartialCharge(selectedTotal < tablePendingTotal);
    setTableId(t.tableId);
    setTableNumber(tablesMultiArea ? `${t.areaName} · ${display}` : display);
    setOrderType("LOCAL");
    if (selections.length === 1) {
      const c = t.comandas.find((x) => x._id === selections[0].comandaId);
      if (c?.customerName) setCustomerName(c.customerName);
    }
    setSaleError(null);
    setShowTablesPanel(false);
    setActiveTable(null);
    setPicked({});
    setPanelAdded(null);
  }

  function toggleComanda(c: OpenComanda) {
    setPicked((prev) => {
      const next = { ...prev };
      const allPicked = c.items.every((it) => it.pendingQty === 0 || next[`${c._id}:${it.index}`] === it.pendingQty);
      for (const it of c.items) {
        if (it.pendingQty === 0) continue;
        const key = `${c._id}:${it.index}`;
        if (allPicked) delete next[key];
        else next[key] = it.pendingQty;
      }
      return next;
    });
  }

  /** Vuelve del paso «Agregar» con la mesa recargada (versión nueva de la comanda) y lo agregado ya marcado para cobrar. */
  async function handleItemsAdded(comandaId: string, count: number, summary: string) {
    if (!activeTable) return;
    const tableKey = activeTable.tableId;
    const prevPicked = picked;
    const tables = await loadOpenTables(tableKey);
    setAddingTo(null);
    const t = tables.find((x) => x.tableId === tableKey);
    const c = t?.comandas.find((x) => x._id === comandaId);
    if (!t || !c) return;
    // Se conserva lo que el cajero ya había elegido y se marca completo lo recién agregado (va al final).
    const next: Record<string, number> = {};
    for (const cc of t.comandas) {
      for (const it of cc.items) {
        const key = `${cc._id}:${it.index}`;
        if (prevPicked[key] && it.pendingQty > 0) next[key] = Math.min(prevPicked[key], it.pendingQty);
      }
    }
    const added = [...c.items].sort((a, b) => a.index - b.index).slice(-count);
    for (const it of added) if (it.pendingQty > 0) next[`${c._id}:${it.index}`] = it.pendingQty;
    setPicked(next);
    setPanelAdded(`Se agregó a la comanda #${c.number}: ${summary}. No se imprimió en cocina ni en barra.`);
  }

  function openPaymentModal() {
    if (cart.length === 0) return;
    setAmountPaid(0);
    setShowPaymentModal(true);
  }

  async function confirmPayment() {
    setShowPaymentModal(false);
    await registerSale();
  }

  /**
   * Imprime en la térmica (CON gaveta) el tiquete recién creado, sin bloquear
   * la pantalla de éxito ni el vaciado del carrito: se llama sin `await` desde
   * `registerSale`. La venta ya está guardada cuando esto corre, así que un
   * fallo acá nunca la hace fallar ni la revierte. Guarda por id de venta para
   * no imprimir dos veces la misma.
   */
  async function autoPrintSale(saleId: string, data: SaleTicketData) {
    if (autoPrintedSaleIds.current.has(saleId)) return;
    autoPrintedSaleIds.current.add(saleId);
    setAutoPrintError(null);
    try {
      const health = await checkAgent();
      if (!health) {
        setAutoPrintError("La venta se guardó pero no se pudo imprimir: el agente de impresión no responde en esta computadora.");
        return;
      }
      const result = await printReceipt(buildSalePayload({ ...data, isReprint: false }, ticketConfig, true));
      if (!result.ok) {
        const detalle = result.detalles?.errores?.length ? `: ${result.detalles.errores.join("; ")}` : "";
        setAutoPrintError(`La venta se guardó pero no se pudo imprimir: ${result.mensaje}${detalle}`);
      }
    } catch (err) {
      setAutoPrintError(`La venta se guardó pero no se pudo imprimir: ${err instanceof Error ? err.message : "error de conexión con el agente"}`);
    }
  }

  async function registerSale() {
    if (cart.length === 0) return;
    setSaving(true);
    setSaleError(null);
    try {
      // El servidor verifica cada precio: las líneas de comandas contra lo congelado en la comanda
      // (por eso viajan comandaId y comandaIndex) y las demás contra el catálogo actual.
      const items = cart.map((l) => ({
        productId:   l.productId,
        productName: l.productName,
        unitPrice:   l.unitPrice,
        quantity:    l.quantity,
        extras:      l.extras ?? [],
        ...(l.weightKg ? { weightKg: l.weightKg } : {}),
        lineTotal:   lineTotal(l),
        ...(l.comandaId ? { comandaId: l.comandaId, comandaIndex: l.itemIndex } : {}),
      }));
      // Impuesto, servicio, subtotal y total los recalcula el servidor con la configuración del
      // negocio; acá solo viaja lo que decide el cajero (ítems, propina, envío, pago).
      const res = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          tableNumber,
          notes: observaciones,
          items,
          tipAmount:      totals.tipAmount,
          // Qué cobros aplica esta venta; el servidor igual exige que estén activos en Configuración.
          ivaEnabled:     applied.iva,
          serviceEnabled: applied.service,
          tipEnabled:     applied.tip,
          paymentMethod,
          mixedPayment:   paymentMethod === "mixto" ? mixedAmounts : undefined,
          orderType,
          pickupTime:     orderType === "PICKUP"  ? pickupTime  : undefined,
          deliveryAddress: orderType === "EXPRESS" ? deliveryAddress : undefined,
          deliveryPhone:  orderType === "EXPRESS" ? deliveryPhone  : undefined,
          deliveryFee:    orderType === "EXPRESS" ? totals.deliveryFee : undefined,
          tableId: tableId || undefined,
          invoiceCustomerId: invoiceCustomer?._id,
          comandaSelections: comandaSelections.map(({ comandaId, version, items: selItems }) => ({ comandaId, version, items: selItems })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaleError({ message: data.error ?? "No se pudo registrar la venta", code: data.code });
        // Lo borraron del registro mientras se cobraba: se suelta para que lo elijan de nuevo.
        if (data.code === "INVOICE_CUSTOMER_NOT_FOUND") setInvoiceCustomer(null);
        return;
      }
      const s = data.sale;
      setInvoiceSentTo(s.invoice?.customer?.email ?? null);
      setInvoiceCustomer(null);
      const prevTableNumber = tableNumber;
      const cameFromComandas = comandaSelections.length > 0;
      const chargedTableId = tableId;
      const saleNumber = String(s._id).slice(-6).toUpperCase();
      setLastSaleNum(saleNumber);
      const ticketData: SaleTicketData = {
        businessName,
        ticketNumber: s.ticketNumber,
        saleNumber,
        date: s.saleDate ?? new Date().toISOString(),
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
        orderType: s.orderType,
        pickupTime: s.pickupTime,
        deliveryAddress: s.deliveryAddress,
        deliveryPhone: s.deliveryPhone,
        deliveryFee: s.deliveryFee,
        amountPaid: needsChangeCalc && amountPaid > 0 ? amountPaid : undefined,
        changeGiven: needsChangeCalc && amountPaid > 0 ? Math.max(0, amountPaid - cashPortion) : undefined,
        partialNote: cameFromComandas && isPartialCharge ? `Pago parcial · ${s.tableNumber}` : undefined,
      };
      setLastSaleTicket(ticketData);
      setShowSuccess(true);
      autoPrintSale(String(s._id), ticketData);
      setCart([]);
      setTipAmount(0);
      setApplied(APPLY_ALL);
      setCustomerName("");
      setTableNumber("");
      setObservaciones("");
      setPickupTime("");
      setDeliveryAddress("");
      setDeliveryPhone("");
      setDeliveryFee(0);
      setAmountPaid(0);
      setMixedAmounts({ efectivo: 0, sinpe: 0, tarjeta: 0 });
      setShowCartPanel(false);
      setComandaSelections([]);
      setTableId("");
      setLastTableNote(data.table?.status === "por_limpiar" ? `${prevTableNumber} quedó por limpiar` : null);
      setNextTableToCharge(null);
      if (isPremium) {
        loadOpenTables().then((tables) => {
          if (!cameFromComandas) return;
          const stillOpen = tables.find((x) => x.tableId === chargedTableId);
          setNextTableToCharge(stillOpen ?? null);
        });
      }
      localStorage.removeItem(DRAFT_KEY);
      window.dispatchEvent(new CustomEvent("pos-cart-update"));
      // Una comanda recién cobrada tiene que salir del contador ya, no en el siguiente ciclo.
      notifyComandasUpdated();
      setTimeout(() => { setShowSuccess(false); setLastTableNote(null); setAutoPrintError(null); }, 10000);
      // "Cobrar a la siguiente persona" no se ata al toast de 10s: entre cobrar, dar el
      // vuelto y decidir si reimprime, el cajero fácilmente tarda más que eso. Se le da
      // su propia ventana, bastante más generosa, para que no desaparezca de golpe.
      setTimeout(() => setNextTableToCharge(null), 120000);
    } finally {
      setSaving(false);
    }
  }

  /** Reabre el panel de Mesas en la misma mesa, con la selección vacía, para cobrarle a la siguiente persona. */
  async function chargeNextPerson() {
    const tid = nextTableToCharge?.tableId;
    if (!tid) return;
    setShowSuccess(false);
    setLastTableNote(null);
    setPanelNotice(null);
    setShowTablesPanel(true);
    const tables = await loadOpenTables();
    const t = tables.find((x) => x.tableId === tid) ?? null;
    setActiveTable(t);
    setPicked({});
    if (!t) setPanelNotice("La mesa ya no tiene comandas abiertas.");
    setNextTableToCharge(null);
  }

  /** Aviso bajo el carrito (escritorio y celular): error de la venta o precios recién actualizados. */
  function renderSaleError() {
    if (!saleError) return null;
    const refreshed = saleError.code === "PRICES_REFRESHED";
    return (
      <div className={`rounded-xl border px-3 py-2.5 text-xs space-y-2 ${
        refreshed ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-600"
      }`}>
        <p>{saleError.message}</p>
        {["VERSION_MISMATCH", "QTY_EXCEEDED", "CONCURRENT_PAYMENT", "COMANDA_NOT_OPEN", "COMANDA_NOT_FOUND", "TABLE_MISMATCH", "COMANDA_ITEMS_MISMATCH"].includes(saleError.code ?? "") && (
          <button type="button" onClick={() => { const tid = tableId; clearComandas(); setShowTablesPanel(true); loadOpenTables(tid); }}
            className="font-semibold underline">Recargar mesas</button>
        )}
        {saleError.code === "PRICE_CHANGED" && (
          <button type="button" onClick={refreshCartPrices} className="font-semibold underline">Actualizar precios</button>
        )}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3 border-b border-brand-muted">
        <h1 className="font-brand text-xl font-bold text-brand-dark">Punto de venta</h1>

        {/* Encargado */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-muted text-sm text-brand-dark/70">
          <UserCircle className="w-4 h-4" /> {session.name}
        </div>
      </div>

      {/* ── Pestañas (puntos de venta abiertos a la vez) — solo Premium ── */}
      {isPremium && tabIds.length > 0 && (
        <div className="flex items-end gap-1 px-2 pt-2 border-b border-brand-muted bg-brand-muted/40 overflow-x-auto scrollbar-hide shrink-0">
          {tabIds.map((id, i) => {
            const info = tabInfo(id);
            const active = id === activeTabId;
            // Las cuentas de mesa muestran su mesa; las de mostrador se numeran para distinguirlas.
            const label = info.isMesa ? info.name : (i === 0 ? "Mostrador" : `Cuenta ${i + 1}`);
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => switchTab(id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchTab(id); } }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-t-xl border border-b-0 whitespace-nowrap text-sm cursor-pointer transition-colors ${
                  active
                    ? "bg-white border-brand-muted text-brand-dark font-semibold -mb-px"
                    : "border-transparent text-brand-dark/55 hover:bg-white/60"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${info.isMesa ? "bg-brand-pink" : "bg-brand-orange"}`} />
                <span className="max-w-[130px] truncate">{label}</span>
                {info.count > 0 && (
                  <span className={`text-xs font-semibold ${active ? "text-brand-pink" : "text-brand-dark/40"}`}>{info.count}</span>
                )}
                {tabIds.length > 1 && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Cerrar ${label}`}
                    onClick={(e) => { e.stopPropagation(); closeTab(id); }}
                    className="ml-0.5 w-4 h-4 rounded flex items-center justify-center text-brand-dark/40 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={newTab}
            disabled={tabIds.length >= MAX_TABS}
            aria-label="Nueva cuenta"
            title={tabIds.length >= MAX_TABS ? `Máximo ${MAX_TABS} cuentas` : "Nueva cuenta"}
            className="mb-1 ml-1 w-7 h-7 shrink-0 rounded-lg text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Comandas sin cobrar — a la vista apenas se abre la caja, no escondido en el menú */}
      {isPremium && (
        <PendingComandasBanner
          className="mx-4 mt-3 shrink-0"
          actionLabel="Ver mesas"
          onAction={() => {
            setShowTablesPanel(true);
            setActiveTable(null);
            setPicked({});
            setPanelNotice(null);
            loadOpenTables();
          }}
        />
      )}

      {/* ── Body: dos columnas ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Columna izquierda: Catálogo ── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-brand-muted pb-20 lg:pb-0">
          {/* Buscador: por nombre o código. El lector de códigos funciona igual sin tocarlo. */}
          <div className="px-3 pt-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dark/30" aria-hidden />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar producto o escribir código"
                aria-label="Buscar producto o código"
                autoComplete="off"
                className="w-full pl-9 pr-9 py-2 border border-brand-muted rounded-xl text-sm bg-white focus:outline-none focus:border-brand-pink"
              />
              {productSearch ? (
                <button
                  type="button"
                  onClick={() => setProductSearch("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-brand-dark/40 hover:text-brand-dark cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-dark/25" aria-hidden />
              )}
            </div>
          </div>

          {/* Aviso de lo escaneado */}
          {scanNotice && (
            <div
              role="status"
              className={`fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg max-w-[90vw] ${
                scanNotice.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {scanNotice.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="truncate">{scanNotice.text}</span>
            </div>
          )}

          {/* Section filter */}
          {showSectionTabs && (
            <div className="flex overflow-x-auto gap-1.5 shrink-0 scrollbar-hide px-3 pt-3" role="tablist" aria-label="Secciones">
              {[{ id: "todas", name: "Todas" }, ...sectionTabs].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={currentSection === s.id}
                  onClick={() => selectSection(s.id)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                    currentSection === s.id
                      ? "gradient-bg text-white border-transparent"
                      : "bg-white text-brand-dark/60 border-brand-muted hover:text-brand-dark"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Category tabs */}
          <div className="flex overflow-x-auto gap-0 border-b border-brand-muted shrink-0 scrollbar-hide px-2 pt-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors capitalize shrink-0 ${
                  activeCategory === cat
                    ? "border-brand-pink text-brand-pink"
                    : "border-transparent text-brand-dark/50 hover:text-brand-dark"
                }`}
              >
                {cat === "todos" ? "Todos" : cat}
              </button>
            ))}
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {visibleProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 opacity-40">
                <span className="text-4xl">📦</span>
                <p className="text-sm">{searchQuery ? "Ningún producto coincide con la búsqueda" : "Sin productos en esta categoría"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleProducts.map((p) => (
                  <ProductCard key={p._id} product={p} onClick={() => openQtyModal(p)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: Pedido (desktop) ── */}
        <div className="hidden lg:flex lg:w-96 flex-col bg-gray-50 overflow-hidden">
          {/* Cart header */}
          <div className="px-4 py-3 border-b border-brand-muted flex items-center gap-2 shrink-0">
            <ShoppingCart className="w-4 h-4 text-brand-dark/60" />
            <span className="text-sm font-semibold text-brand-dark">
              Pedido en curso {cart.length > 0 && <span className="text-brand-pink">({cart.length})</span>}
            </span>
          </div>

          {/* Tipo de pedido + Cliente + campos condicionales */}
          <div className="px-3 pt-2 pb-1 space-y-2 shrink-0">
            <div className="flex gap-2">
              <div className="flex-1"><OrderTypeSelector value={orderType} onChange={changeOrderType} /></div>
              {orderType === "LOCAL" && isPremium && (
                <button
                  type="button"
                  onClick={() => { setShowTablesPanel(true); setActiveTable(null); setPicked({}); setPanelNotice(null); loadOpenTables(); }}
                  className="relative flex items-center gap-1.5 px-3 rounded-xl border border-brand-pink/40 bg-brand-pink/5 text-brand-pink text-xs font-semibold hover:bg-brand-pink/10 transition-colors"
                >
                  <Utensils className="w-3.5 h-3.5" /> Mesas
                  {openTables.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full gradient-bg text-white text-[10px] font-bold flex items-center justify-center">
                      {openTables.length}
                    </span>
                  )}
                </button>
              )}
            </div>
            {comandaSelections.length > 0 && (
              <div className="flex items-center justify-between gap-2 bg-brand-pink/5 border border-brand-pink/20 rounded-xl px-3 py-1.5">
                <span className="text-xs text-brand-pink font-medium truncate">
                  {tableNumber} · Comandas {comandaSelections.map((s) => `#${s.number}`).join(", ")}
                </span>
                <button type="button" onClick={clearComandas} className="text-xs font-semibold text-brand-pink/70 hover:text-brand-pink shrink-0">
                  Quitar comandas
                </button>
              </div>
            )}
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nombre del cliente (opcional)"
              className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink bg-white"
            />
            {orderType === "LOCAL" && (
              <TableSelect
                tableGroups={tableGroups}
                value={tableNumber}
                onChange={handleTableChange}
                className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink bg-white"
              />
            )}
            {orderType === "PICKUP" && (
              <input
                type="text"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                placeholder="Hora de recogida (ej: 2:30 pm)"
                className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink bg-white"
              />
            )}
            {orderType === "EXPRESS" && (<>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Dirección de entrega"
                className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink bg-white"
              />
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="Teléfono"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink bg-white"
                />
                <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1.5 bg-white">
                  <span className="text-xs text-gray-400 whitespace-nowrap">₡ Envío</span>
                  <input
                    type="number"
                    min={0}
                    value={deliveryFee || ""}
                    onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="w-14 text-right text-sm font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </>)}
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones (opcional)"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-brand-pink bg-white resize-none"
            />
          </div>

          {/* Cart lines */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-30">
                <ShoppingCart className="w-8 h-8" />
                <p className="text-xs">Seleccioná productos</p>
              </div>
            ) : (
              cart.map((line) => (
                <div key={lineKey(line)} className="bg-white rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{line.productName}</p>
                      {line.weightKg ? <p className="text-xs text-gray-500">{weightDetail(line.weightKg, line.unitPrice)}</p> : null}
                      <LineExtras extras={line.extras} className="mt-0.5" />
                      {line.comandaId && (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-brand-pink bg-brand-pink/10 rounded-full px-1.5 py-0.5">
                          Comanda #{line.comandaNumber}
                        </span>
                      )}
                      {line.note && <p className="text-xs text-gray-400 italic">{line.note}</p>}
                    </div>
                    {!line.comandaId && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="destructive"
                        className="shrink-0"
                        title="Quitar del carrito"
                        aria-label="Quitar del carrito"
                        onClick={() => removeLine(lineKey(line))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {line.comandaId ? (
                      <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(lineKey(line), -1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(lineKey(line), 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <span className="text-sm font-bold text-brand-pink">
                      {fmt(lineTotal(line))}
                    </span>
                  </div>
                  {line.quantity > 1 && (
                    <p className="text-xs text-gray-400 mt-1">{fmt(effectiveUnitPrice(line))} c/u</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Totals + checkout */}
          <div className="shrink-0 border-t border-brand-muted bg-white px-4 py-4 space-y-3">
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="text-brand-dark/60">Subtotal</span>
              <span className="font-semibold">{fmt(subtotal)}</span>
            </div>

            {/* Envío (Express) */}
            {orderType === "EXPRESS" && deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-dark/60">🛵 Envío</span>
                <span className="font-semibold">{fmt(deliveryFee)}</span>
              </div>
            )}

            <ChargeLines
              charges={charges}
              orderType={orderType}
              applied={applied}
              onAppliedChange={setApplied}
              totals={totals}
              tipAmount={tipAmount}
              onTipChange={setTipAmount}
              tipInputClassName="w-20 text-right border border-gray-200 rounded-lg px-2 py-0.5 text-sm font-semibold focus:outline-none focus:border-brand-pink"
            />

            {/* Total */}
            <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
              <span>Total</span>
              <span className="text-brand-pink text-lg">{fmt(total)}</span>
            </div>

            {/* Método de pago */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark/40 mb-1.5">¿Cómo paga?</p>
              <PaymentMethodPicker compact value={paymentMethod} onChange={choosePaymentMethod} />
            </div>

            {/* Error de venta */}
            {renderSaleError()}

            {/* Register button */}
            <Button
              className="w-full"
              disabled={cart.length === 0 || saving}
              onClick={openPaymentModal}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? "Registrando..." : "Registrar venta"}
            </Button>

            {/* Success toast */}
            {showSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-700">
                <Check className="w-4 h-4 shrink-0" />
                ¡Venta registrada! <span className="font-mono font-bold">#{lastSaleNum}</span>{lastTableNote ? ` · ${lastTableNote}` : ""}
              </div>
            )}
            {showSuccess && invoiceSentTo && (
              <div className="flex items-start gap-2 bg-brand-pink/5 border border-brand-pink/20 rounded-xl px-3 py-2 text-xs text-brand-dark/70">
                <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-pink" />
                <span>El comprobante sale por correo a <span className="font-semibold break-all">{invoiceSentTo}</span>.</span>
              </div>
            )}
            {showSuccess && autoPrintError && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {autoPrintError}
              </div>
            )}
            {nextTableToCharge && (
              <Button type="button" variant="secondary" className="w-full" onClick={chargeNextPerson}>
                Cobrar a la siguiente persona
              </Button>
            )}

            {/* Imprimir: térmica (principal) + PDF (respaldo) */}
            {lastSaleTicket && (
              <div className="space-y-1.5">
                <ThermalPrintButton
                  label="Reimprimir en térmica"
                  className="w-full py-2 px-4"
                  getPayload={() => buildSalePayload(lastSaleTicket, ticketConfig, true)}
                  onPdfFallback={() => saleTicket(lastSaleTicket, ticketConfig)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => saleTicket(lastSaleTicket, ticketConfig)}
                >
                  <Printer className="w-4 h-4" /> Descargar PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Barra inferior sticky (solo móvil) ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-brand-muted shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <button
          type="button"
          onClick={() => setShowCartPanel(true)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingCart className="w-5 h-5 text-brand-dark/60" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full gradient-bg text-white text-[10px] font-bold flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
            <span className="text-sm font-semibold text-brand-dark">
              {cart.length === 0 ? "Pedido vacío" : `${cart.length} producto${cart.length > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-brand-pink text-lg">{fmt(total)}</span>
            <span className="text-xs text-brand-dark/40 font-medium">Ver pedido →</span>
          </div>
        </button>
      </div>

      {/* ── Bottom sheet: carrito móvil ── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 flex flex-col justify-end transition-all duration-300 ${
          showCartPanel ? "visible" : "invisible pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showCartPanel ? "opacity-100" : "opacity-0"}`}
          onClick={() => setShowCartPanel(false)}
        />
        {/* Sheet */}
        <div
          className={`relative bg-white rounded-t-2xl flex flex-col overflow-hidden transition-transform duration-300 ${
            showCartPanel ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight: "88vh" }}
        >
          {/* Handle bar */}
          <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-gray-200" />
            <span className="text-sm font-semibold text-brand-dark pt-1">
              Pedido en curso {cart.length > 0 && <span className="text-brand-pink">({cart.length})</span>}
            </span>
            <button type="button" onClick={() => setShowCartPanel(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tipo de pedido + Cliente + campos condicionales */}
          <div className="px-3 pt-2 pb-1 space-y-2 shrink-0">
            <div className="flex gap-2">
              <div className="flex-1"><OrderTypeSelector value={orderType} onChange={changeOrderType} /></div>
              {orderType === "LOCAL" && isPremium && (
                <button
                  type="button"
                  onClick={() => { setShowTablesPanel(true); setActiveTable(null); setPicked({}); setPanelNotice(null); loadOpenTables(); }}
                  className="relative flex items-center gap-1.5 px-3 rounded-xl border border-brand-pink/40 bg-brand-pink/5 text-brand-pink text-xs font-semibold hover:bg-brand-pink/10 transition-colors"
                >
                  <Utensils className="w-3.5 h-3.5" /> Mesas
                  {openTables.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full gradient-bg text-white text-[10px] font-bold flex items-center justify-center">
                      {openTables.length}
                    </span>
                  )}
                </button>
              )}
            </div>
            {comandaSelections.length > 0 && (
              <div className="flex items-center justify-between gap-2 bg-brand-pink/5 border border-brand-pink/20 rounded-xl px-3 py-1.5">
                <span className="text-xs text-brand-pink font-medium truncate">
                  {tableNumber} · Comandas {comandaSelections.map((s) => `#${s.number}`).join(", ")}
                </span>
                <button type="button" onClick={clearComandas} className="text-xs font-semibold text-brand-pink/70 hover:text-brand-pink shrink-0">
                  Quitar comandas
                </button>
              </div>
            )}
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nombre del cliente (opcional)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white"
            />
            {orderType === "LOCAL" && (
              <TableSelect
                tableGroups={tableGroups}
                value={tableNumber}
                onChange={handleTableChange}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white"
              />
            )}
            {orderType === "PICKUP" && (
              <input
                type="text"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                placeholder="Hora de recogida (ej: 2:30 pm)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white"
              />
            )}
            {orderType === "EXPRESS" && (<>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Dirección de entrega"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white"
              />
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="Teléfono"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white"
                />
                <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-2 bg-white">
                  <span className="text-xs text-gray-400 whitespace-nowrap">₡ Envío</span>
                  <input
                    type="number"
                    min={0}
                    value={deliveryFee || ""}
                    onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="w-14 text-right text-sm font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </>)}
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones (opcional)"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink bg-white resize-none"
            />
          </div>

          {/* Cart lines */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 gap-2 opacity-30">
                <ShoppingCart className="w-8 h-8" />
                <p className="text-xs">Seleccioná productos del catálogo</p>
              </div>
            ) : (
              cart.map((line) => (
                <div key={lineKey(line)} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{line.productName}</p>
                      {line.weightKg ? <p className="text-xs text-gray-500">{weightDetail(line.weightKg, line.unitPrice)}</p> : null}
                      <LineExtras extras={line.extras} className="mt-0.5" />
                      {line.comandaId && (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-brand-pink bg-brand-pink/10 rounded-full px-1.5 py-0.5">
                          Comanda #{line.comandaNumber}
                        </span>
                      )}
                      {line.note && <p className="text-xs text-gray-400 italic">{line.note}</p>}
                    </div>
                    {!line.comandaId && (
                      <Button type="button" size="icon-xs" variant="destructive" className="shrink-0"
                        title="Quitar del carrito" aria-label="Quitar del carrito"
                        onClick={() => removeLine(lineKey(line))}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {line.comandaId ? (
                      <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => updateQty(lineKey(line), -1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                        <button type="button" onClick={() => updateQty(lineKey(line), 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <span className="text-sm font-bold text-brand-pink">{fmt(lineTotal(line))}</span>
                  </div>
                  {line.quantity > 1 && <p className="text-xs text-gray-400 mt-1">{fmt(effectiveUnitPrice(line))} c/u</p>}
                </div>
              ))
            )}
          </div>

          {/* Totals + checkout */}
          <div className="shrink-0 border-t border-brand-muted bg-white px-4 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-brand-dark/60">Subtotal</span>
              <span className="font-semibold">{fmt(subtotal)}</span>
            </div>
            {/* Envío (Express) */}
            {orderType === "EXPRESS" && deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-dark/60">🛵 Envío</span>
                <span className="font-semibold">{fmt(deliveryFee)}</span>
              </div>
            )}
            <ChargeLines
              charges={charges}
              orderType={orderType}
              applied={applied}
              onAppliedChange={setApplied}
              totals={totals}
              tipAmount={tipAmount}
              onTipChange={setTipAmount}
              tipInputClassName="w-24 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:border-brand-pink"
            />
            <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
              <span>Total</span>
              <span className="text-brand-pink text-lg">{fmt(total)}</span>
            </div>
            {/* Métodos de pago */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark/40 mb-1.5">¿Cómo paga?</p>
              <PaymentMethodPicker value={paymentMethod} onChange={choosePaymentMethod} />
            </div>
            {renderSaleError()}
            <Button className="w-full py-3 text-base" disabled={cart.length === 0 || saving} onClick={openPaymentModal}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? "Registrando..." : "Registrar venta"}
            </Button>
            {showSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-700">
                <Check className="w-4 h-4 shrink-0" />
                ¡Venta registrada! <span className="font-mono font-bold">#{lastSaleNum}</span>{lastTableNote ? ` · ${lastTableNote}` : ""}
              </div>
            )}
            {showSuccess && invoiceSentTo && (
              <div className="flex items-start gap-2 bg-brand-pink/5 border border-brand-pink/20 rounded-xl px-3 py-2 text-xs text-brand-dark/70">
                <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-pink" />
                <span>El comprobante sale por correo a <span className="font-semibold break-all">{invoiceSentTo}</span>.</span>
              </div>
            )}
            {showSuccess && autoPrintError && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {autoPrintError}
              </div>
            )}
            {nextTableToCharge && (
              <Button type="button" variant="secondary" className="w-full" onClick={chargeNextPerson}>
                Cobrar a la siguiente persona
              </Button>
            )}

            {/* Imprimir: térmica (principal) + PDF (respaldo) */}
            {lastSaleTicket && (
              <div className="space-y-1.5">
                <ThermalPrintButton
                  label="Reimprimir en térmica"
                  className="w-full py-2 px-4"
                  getPayload={() => buildSalePayload(lastSaleTicket, ticketConfig, true)}
                  onPdfFallback={() => saleTicket(lastSaleTicket, ticketConfig)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => saleTicket(lastSaleTicket, ticketConfig)}
                >
                  <Printer className="w-4 h-4" /> Descargar PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de cobro ── */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => { if (!open) setShowPaymentModal(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Cobrar venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-2">
            {/* Total destacado */}
            <div className="text-center py-2.5 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-500 mb-0.5">Total a pagar</p>
              <p className="text-3xl font-bold text-brand-pink">{fmt(total)}</p>
              {/* La forma de pago se repite acá, también cuando es efectivo: es el último momento
                  para darse cuenta de que se marcó la que no era. */}
              <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                <PaymentMethodChip method={paymentMethod} />
                {paymentMethod === "mixto" && mixedAmounts.efectivo > 0 && (
                  <span className="text-xs text-gray-400">efectivo {fmt(mixedAmounts.efectivo)}</span>
                )}
              </div>
            </div>

            {needsChangeCalc ? (<>
              {/* Campo "Paga con" */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {paymentMethod === "mixto" ? "Paga con (porción efectivo)" : "Paga con"}
                </label>
                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2 focus-within:border-brand-pink bg-white transition-colors">
                  <span className="text-sm text-gray-400 font-medium shrink-0">₡</span>
                  <input
                    ref={payAmountRef}
                    type="text"
                    inputMode="numeric"
                    value={amountPaid || ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setAmountPaid(raw === "" ? 0 : Number(raw));
                    }}
                    placeholder="0"
                    className="flex-1 min-w-0 text-right text-2xl font-bold focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Montos rápidos */}
              <div className="grid grid-cols-3 gap-1.5">
                {[1000, 2000, 5000, 10000, 20000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountPaid((v) => v + amt)}
                    className="py-1.5 rounded-xl border border-brand-muted text-xs font-semibold hover:border-brand-pink hover:bg-brand-pink/5 transition-colors"
                  >
                    +{fmt(amt)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmountPaid(cashPortion)}
                  className="py-1.5 rounded-xl border-2 border-brand-pink/40 bg-brand-pink/5 text-brand-pink text-xs font-bold hover:bg-brand-pink/10 transition-colors"
                >
                  Exacto
                </button>
              </div>

              {/* Vuelto / Faltante */}
              <div className={`rounded-2xl py-3 text-center ${change >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className={`text-xs font-semibold mb-0.5 ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {change >= 0 ? "Vuelto" : "Faltante"}
                </p>
                <p className={`text-2xl font-bold ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {fmt(Math.abs(change))}
                </p>
              </div>
            </>) : (
              <div className="text-center py-4 bg-gray-50 rounded-2xl">
                <p className="text-sm font-semibold text-gray-600">Pago exacto</p>
                <p className="text-xs text-gray-400 mt-1">No se requiere vuelto</p>
              </div>
            )}

            {/* Factura: el comprobante le llega por correo al cliente registrado */}
            {canInvoice && (
              <InvoiceCustomerPicker value={invoiceCustomer} onChange={setInvoiceCustomer} disabled={saving} />
            )}

            {/* Acciones */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="cancel"
                className="flex-1 h-auto py-2.5 rounded-xl"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancelar
              </Button>
              <button
                type="button"
                disabled={saving || (needsChangeCalc && amountPaid < cashPortion && amountPaid > 0)}
                onClick={confirmPayment}
                className="flex-1 py-2.5 rounded-xl gradient-bg text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar venta
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal pago mixto ── */}
      <Dialog open={showMixedModal} onOpenChange={(open) => { if (!open) setShowMixedModal(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Repartir pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6 pt-2">
            <p className="text-sm text-gray-500">Total a repartir: <span className="font-bold text-gray-900">{fmt(total)}</span></p>
            {SPLIT_METHODS.map((m) => {
              const Icon = PAYMENT_METHOD_ICONS[m];
              const style = PAYMENT_METHOD_STYLE[m];
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 w-24 shrink-0 text-sm font-semibold text-brand-dark">
                    <Icon className="w-4 h-4 shrink-0" style={{ color: style.accent }} strokeWidth={2.4} />
                    {PAYMENT_METHOD_LABELS[m]}
                  </span>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-xs text-gray-400">₡</span>
                    <input
                      type="number"
                      min={0}
                      value={mixedAmounts[m]}
                      onChange={(e) => setMixedAmounts((prev) => ({ ...prev, [m]: Math.max(0, Number(e.target.value)) }))}
                      className="flex-1 text-right border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-brand-pink"
                    />
                  </div>
                </div>
              );
            })}
            {/* Restante */}
            <div className={`flex justify-between text-sm font-semibold pt-2 border-t ${mixedRemainder === 0 ? "text-emerald-600" : "text-red-500"}`}>
              <span>{mixedRemainder > 0 ? "Restante" : mixedRemainder < 0 ? "Exceso" : "✓ Cuadra"}</span>
              <span>{mixedRemainder !== 0 ? fmt(Math.abs(mixedRemainder)) : ""}</span>
            </div>
            <div className="flex justify-center pt-1">
            <button
              type="button"
              disabled={mixedRemainder !== 0}
              onClick={() => setShowMixedModal(false)}
              className="px-8 py-2 rounded-xl gradient-bg text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmar reparto
            </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de cantidad ── */}
      <WeighDialog product={weighing} onClose={() => setWeighing(null)} onConfirm={addWeighed} />
      <OpenPriceDialog product={pricing} onClose={() => setPricing(null)} onConfirm={addOpenPriced} />

      <Dialog open={!!qtyModal} onOpenChange={(open) => !open && setQtyModal(null)}>
        <DialogContent className={qtyModal?.extras?.length ? "max-w-sm" : "max-w-xs"}>
          <DialogHeader>
            <DialogTitle className="text-base">{qtyModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-2">
            <p className="text-brand-pink font-bold text-lg">{qtyModal ? fmt(qtyModal.price) : ""}</p>
            {qtyModal?.extras && qtyModal.extras.length > 0 && (
              <div className="w-full">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Extras (para cada unidad)</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {qtyModal.extras.map((extra) => {
                    const selected = qtyExtras.includes(extra.name);
                    return (
                      <button
                        key={extra.name}
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() => setQtyExtras((prev) => selected ? prev.filter((n) => n !== extra.name) : [...prev, extra.name])}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-colors ${
                          selected ? "border-brand-pink bg-brand-pink/10" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-brand-pink border-brand-pink text-white" : "border-gray-300"}`}>
                          {selected && <Check className="w-3 h-3" />}
                        </span>
                        <span className="flex-1 text-gray-800">{extra.name}</span>
                        <span className="font-semibold text-gray-600">{extra.price > 0 ? `+${fmt(extra.price)}` : "Sin costo"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setQtyInput((v) => Math.max(1, v - 1))}
                className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={1}
                value={qtyInput}
                onChange={(e) => setQtyInput(Math.max(1, Number(e.target.value)))}
                className="w-16 text-center text-2xl font-bold border-b-2 border-gray-300 focus:border-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQtyInput((v) => v + 1)}
                className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-400">
              Subtotal: <span className="font-bold text-gray-700">{qtyModal ? fmt(lineTotal({ unitPrice: qtyModal.price, quantity: qtyInput, extras: qtyChosenExtras })) : ""}</span>
            </p>
            <button
              type="button"
              onClick={addToCart}
              className="flex items-center justify-center gap-2 px-8 py-2 rounded-xl gradient-bg text-white text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Agregar al pedido
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Panel Mesas ── */}
      <Dialog open={showTablesPanel} onOpenChange={(o) => { if (!o) { setShowTablesPanel(false); setActiveTable(null); setPanelNotice(null); setAddingTo(null); setPanelAdded(null); } }}>
        <DialogContent className="sm:max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-base">
              {activeTable && addingTo ? (
                <button type="button" onClick={() => setAddingTo(null)} className="inline-flex items-center gap-1 text-brand-dark/60 hover:text-brand-dark">
                  <ChevronLeft className="w-4 h-4" /> {activeTable.tableShape === "barstool" ? "Banqueta" : "Mesa"} {activeTable.tableLabel}
                </button>
              ) : activeTable ? (
                <button type="button" onClick={() => { setActiveTable(null); setPicked({}); setPanelNotice(null); setPanelAdded(null); }} className="inline-flex items-center gap-1 text-brand-dark/60 hover:text-brand-dark">
                  <ChevronLeft className="w-4 h-4" /> Mesas
                </button>
              ) : "Mesas con comandas abiertas"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-2 space-y-3">
            {!activeTable ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-dark/60">{openTables.length} mesas</span>
                  <Button type="button" variant="ghost" size="sm" disabled={tablesLoading} onClick={() => loadOpenTables()}>
                    <RefreshCw className={`w-3.5 h-3.5 ${tablesLoading ? "animate-spin" : ""}`} /> Actualizar
                  </Button>
                </div>
                {panelNotice && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {panelNotice}
                  </div>
                )}
                {tablesLoading && openTables.length === 0 ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-pink" /></div>
                ) : openTables.length === 0 ? (
                  <p className="text-sm text-brand-dark/40 text-center py-8">No hay mesas con comandas abiertas.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {openTables.map((t) => {
                      const level = badgeLevel(t.minutes, thresholds);
                      const hasPrevious = t.comandas.some((c) => c.isPrevious);
                      return (
                        <button
                          key={t.tableId}
                          type="button"
                          onClick={() => {
                            setActiveTable(t);
                            setPicked(defaultPicks(t));
                            setPanelAdded(null);
                            setPanelNotice(
                              comandaSelections.length > 0 && tableId !== t.tableId
                                ? `El pedido en curso tiene comandas de ${tableNumber || "otra mesa"}. Al cobrar esta mesa se reemplazan.`
                                : null
                            );
                          }}
                          className="text-left rounded-xl border border-brand-muted p-3 hover:border-brand-pink/40 transition-colors"
                        >
                          <p className="text-sm font-semibold text-brand-dark">
                            {t.tableShape === "barstool" ? "Banqueta" : "Mesa"} {t.tableLabel}
                            {tablesMultiArea && <span className="text-brand-dark/50 font-normal"> · {t.areaName}</span>}
                          </p>
                          <p className="text-xs text-brand-dark/60 mt-0.5">
                            {t.openCount} comanda{t.openCount !== 1 ? "s" : ""} · {pendingItemCount(t)} ítem{pendingItemCount(t) !== 1 ? "s" : ""} · {fmt(t.pendingTotal)} pendiente
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-semibold ${MIN_TEXT[level]}`}>{t.minutes} min</span>
                            {hasPrevious && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-full px-1.5 py-0.5">Días anteriores</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : addingTo ? (
              <AddToComandaPanel
                comandaId={addingTo._id}
                comandaNumber={addingTo.number}
                products={products}
                onCancel={() => setAddingTo(null)}
                onAdded={({ count, summary }) => handleItemsAdded(addingTo._id, count, summary)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold text-brand-dark">
                      {activeTable.tableShape === "barstool" ? "Banqueta" : "Mesa"} {activeTable.tableLabel}
                      {tablesMultiArea && <span className="text-brand-dark/50 font-normal"> · {activeTable.areaName}</span>}
                    </p>
                    <p className="text-xs text-brand-dark/50">
                      {activeTable.tableStatus === "libre" ? "Libre" : activeTable.tableStatus === "ocupada" ? "Ocupada" : activeTable.tableStatus === "por_limpiar" ? "Por limpiar" : activeTable.tableStatus === "reservada" ? "Reservada" : ""}
                      {" · "}{activeTable.openCount} comandas · {activeTable.minutes} min
                    </p>
                  </div>
                </div>

                {panelNotice && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {panelNotice}
                  </div>
                )}
                {panelAdded && (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {panelAdded}
                  </div>
                )}

                {(["hoy", "anteriores"] as const).map((group) => {
                  const list = activeTable.comandas.filter((c) => (group === "hoy" ? !c.isPrevious : c.isPrevious));
                  if (list.length === 0) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <p className="text-xs font-semibold text-brand-dark/50 uppercase tracking-wide">{group === "hoy" ? "Hoy" : "Anteriores"}</p>
                      {group === "anteriores" && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Estas comandas son de días anteriores. Revisá con el mesero antes de cobrarlas.
                        </div>
                      )}
                      {list.map((c) => {
                        const pendingItems = c.items.filter((it) => it.pendingQty > 0);
                        const allChecked = pendingItems.length > 0 && pendingItems.every((it) => picked[`${c._id}:${it.index}`] === it.pendingQty);
                        return (
                          <div key={c._id} className="rounded-xl border border-brand-muted p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                className="accent-brand-pink mt-0.5"
                                checked={allChecked}
                                onChange={() => toggleComanda(c)}
                                disabled={pendingItems.length === 0}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-brand-dark">#{c.number}</span>
                                  <span className="text-xs text-brand-dark/50">{c.waiterName}</span>
                                  <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${c.status === "servida" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                                    {c.status === "servida" ? "Servida" : "Enviada"}
                                  </span>
                                  <span className="text-xs text-brand-dark/40">
                                    {c.isPrevious && `${new Date(c.sentAt).toLocaleDateString("es-CR", { day: "2-digit", month: "short" })} `}
                                    {new Date(c.sentAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {c.customerName && <span className="text-xs text-brand-dark/50">{c.customerName}</span>}
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-brand-pink shrink-0">{fmt(c.pendingTotal)}</span>
                            </div>
                            <div className="space-y-1.5 pl-6">
                              {c.items.map((it) => {
                                const key = `${c._id}:${it.index}`;
                                const qty = picked[key] ?? 0;
                                if (it.pendingQty === 0) {
                                  return (
                                    <div key={key} className="flex items-center justify-between opacity-40 text-sm">
                                      <span>{it.productName}</span>
                                      <span className="text-xs">Pagado</span>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={key} className="flex items-center justify-between gap-2 text-sm">
                                    <label className="flex items-start gap-2 flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        className="accent-brand-pink mt-1"
                                        checked={qty > 0}
                                        onChange={(e) => setPicked((prev) => {
                                          const next = { ...prev };
                                          if (e.target.checked) next[key] = it.pendingQty; else delete next[key];
                                          return next;
                                        })}
                                      />
                                      <span className="min-w-0">
                                        <span className="block">{it.productName}</span>
                                        {it.weightKg ? <span className="block text-xs text-gray-500">{weightDetail(it.weightKg, it.unitPrice)}</span> : null}
                                        <LineExtras extras={it.extras} />
                                        {it.note && <span className="block text-xs text-gray-400 italic">{it.note}</span>}
                                        <span className="block text-xs text-brand-dark/40">pendiente {it.pendingQty} de {it.quantity}</span>
                                      </span>
                                    </label>
                                    {qty > 0 && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button type="button" onClick={() => setPicked((prev) => ({ ...prev, [key]: Math.max(1, (prev[key] ?? 1) - 1) }))}
                                          className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-5 text-center text-xs font-bold">{qty}</span>
                                        <button type="button" onClick={() => setPicked((prev) => ({ ...prev, [key]: Math.min(it.pendingQty, (prev[key] ?? 1) + 1) }))}
                                          className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                                          <Plus className="w-3 h-3" />
                                        </button>
                                        <span className="text-xs font-semibold text-brand-pink w-14 text-right">{fmt(lineTotal({ ...it, quantity: qty }))}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {c.notes && <p className="text-xs text-gray-400 pl-6">{c.notes}</p>}
                            <button
                              type="button"
                              onClick={() => { setAddingTo(c); setPanelAdded(null); }}
                              className="ml-6 inline-flex items-center gap-1 text-xs font-medium text-brand-pink hover:underline"
                            >
                              <Plus className="w-3 h-3" /> Agregar producto
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {(() => {
                  const count = Object.values(picked).filter((q) => q > 0).length;
                  let sum = 0;
                  let tablePendingTotal = 0;
                  for (const c of activeTable.comandas) {
                    for (const it of c.items) {
                      tablePendingTotal += lineTotal({ ...it, quantity: it.pendingQty });
                      const q = picked[`${c._id}:${it.index}`] ?? 0;
                      sum += lineTotal({ ...it, quantity: Math.min(q, it.pendingQty) });
                    }
                  }
                  const willRemain = Math.max(0, tablePendingTotal - sum);
                  return (
                    <div className="sticky bottom-0 bg-white pt-3 border-t border-brand-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-sm text-brand-dark/60">
                        Seleccionado: {count} ítem{count !== 1 ? "s" : ""} · {fmt(sum)} · Quedará pendiente: {fmt(willRemain)}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <Button type="button" variant="cancel" className="flex-1 sm:flex-none" onClick={() => { setActiveTable(null); setPicked({}); setPanelNotice(null); setPanelAdded(null); }}>Cancelar</Button>
                        <Button type="button" className="flex-1 sm:flex-none" disabled={count === 0} onClick={applySelection}>Cobrar seleccionado</Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
