"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Loader2, Plus, Minus, X, ChevronDown, Check, ShoppingCart, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saleTicket, DEFAULT_TICKET_CONFIG, type SaleTicketData, type TicketConfigData } from "@/lib/ticket";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderType = "LOCAL" | "PICKUP" | "EXPRESS";

interface CashUser { _id: string; name: string; }

interface ProductRow {
  _id: string;
  name: string;
  price: number;
  image?: string;
  category: string;
  available: boolean;
}

interface CartLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

interface PosConfig {
  ivaEnabled: boolean;
  ivaRate: number;
  tipEnabled: boolean;
  serviceRate: number;
}

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
        <p className="text-sm font-semibold text-brand-pink mt-1">{fmt(product.price)}</p>
      </div>
    </button>
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
  const pathname = usePathname();
  const tenantSlug = pathname.split("/")[1];
  const DRAFT_KEY = `pos_cart_${tenantSlug}`;

  // ── Data state ──────────────────────────────────────────────────
  const [cashUsers, setCashUsers]     = useState<CashUser[]>([]);
  const [products, setProducts]       = useState<ProductRow[]>([]);
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [ticketConfig, setTicketConfig] = useState<TicketConfigData>(DEFAULT_TICKET_CONFIG);
  const [loading, setLoading]         = useState(true);

  // ── Session state ────────────────────────────────────────────────
  const [cashUser, setCashUser]       = useState<CashUser | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);

  // ── Catalog state ────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState("todos");
  const [qtyModal, setQtyModal]             = useState<ProductRow | null>(null);
  const [qtyInput, setQtyInput]             = useState(1);

  // ── Cart state ───────────────────────────────────────────────────
  const [cart, setCart]             = useState<CartLine[]>([]);
  const [tipAmount, setTipAmount]   = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber]   = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "sinpe" | "tarjeta" | "mixto">("efectivo");
  const [showMixedModal, setShowMixedModal] = useState(false);
  const [mixedAmounts, setMixedAmounts]     = useState({ efectivo: 0, sinpe: 0, tarjeta: 0 });
  const [showCartPanel, setShowCartPanel]   = useState(false);

  // ── Order type state ─────────────────────────────────────────────
  const [orderType, setOrderType]           = useState<OrderType>("LOCAL");
  const [pickupTime, setPickupTime]         = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone]   = useState("");
  const [deliveryFee, setDeliveryFee]       = useState(0);

  // ── Sale state ───────────────────────────────────────────────────
  const [saving, setSaving]           = useState(false);
  const [lastSaleNum, setLastSaleNum] = useState<string | null>(null);
  const [lastSaleTicket, setLastSaleTicket] = useState<SaleTicketData | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Payment modal state ──────────────────────────────────────────
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amountPaid, setAmountPaid]             = useState(0);
  const payAmountRef = useRef<HTMLInputElement>(null);

  // ── IVA / Servicio / Propina (siempre off al abrir) ──────────────
  const [ivaEnabled, setIvaEnabled]         = useState(false);
  const [ivaRate, setIvaRate]               = useState(13);
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [serviceRate, setServiceRate]       = useState(10);
  const [tipEnabled, setTipEnabled]         = useState(false);

  // Flag: solo persistir DESPUÉS de que el draft haya sido restaurado
  const [draftLoaded, setDraftLoaded] = useState(false);

  // ── Persist draft cart (solo rates y carrito, NO los enabled flags) ─
  useEffect(() => {
    if (!draftLoaded || !tenantSlug) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ cart, paymentMethod, ivaRate, serviceRate, tipAmount, orderType }));
    window.dispatchEvent(new CustomEvent("pos-cart-update"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, paymentMethod, ivaRate, serviceRate, tipAmount, orderType, draftLoaded]);

  // ── Load data ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [usersRes, productsRes, configRes, meRes, areasRes, salonTablesRes] = await Promise.all([
        fetch("/api/admin/cash-users").then((r) => r.json()),
        fetch("/api/admin/products").then((r) => r.json()),
        fetch("/api/admin/pos-config").then((r) => r.json()),
        fetch("/api/admin/auth/me").then((r) => r.json()).catch(() => ({})),
        fetch("/api/admin/salon/areas").then((r) => r.json()).catch(() => ({})),
        fetch("/api/admin/salon/tables").then((r) => r.json()).catch(() => ({})),
      ]);
      setCashUsers(usersRes.users ?? []);
      setProducts((productsRes.products ?? []).filter((p: ProductRow) => p.available));
      setBusinessName(meRes.tenantName ?? tenantSlug);
      if (meRes.ticketConfig) setTicketConfig({ ...DEFAULT_TICKET_CONFIG, ...meRes.ticketConfig });
      const cfg: PosConfig = configRes;

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
      // Tomar solo las TASAS del config (los toggles siempre arrancan off)
      if (typeof cfg.ivaRate     === "number") setIvaRate(cfg.ivaRate);
      if (typeof cfg.serviceRate === "number") setServiceRate(cfg.serviceRate);
      // Restaurar borrador del carrito si existe (solo carrito y tasas, nunca enabled flags)
      try {
        const raw = localStorage.getItem(`pos_cart_${pathname.split("/")[1]}`);
        if (raw) {
          const draft = JSON.parse(raw);
          if (Array.isArray(draft.cart) && draft.cart.length > 0) {
            setCart(draft.cart);
            if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
            if (typeof draft.ivaRate     === "number") setIvaRate(draft.ivaRate);
            if (typeof draft.serviceRate === "number") setServiceRate(draft.serviceRate);
            if (typeof draft.tipAmount   === "number") setTipAmount(draft.tipAmount);
            if (draft.orderType) setOrderType(draft.orderType);
          }
        }
      } catch { /* ignore */ }

      setDraftLoaded(true);
      setLoading(false);
    }
    load();
  }, []);

  // Restore cash user from localStorage
  useEffect(() => {
    if (cashUsers.length === 0) return;
    try {
      const saved = localStorage.getItem("pos_cashUser");
      if (saved) {
        const parsed = JSON.parse(saved) as CashUser;
        if (cashUsers.find((u) => u._id === parsed._id)) setCashUser(parsed);
      }
    } catch { /* ignore */ }
  }, [cashUsers]);

  // Close user picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setShowUserPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus payment input when modal opens
  useEffect(() => {
    if (showPaymentModal) {
      const timer = setTimeout(() => payAmountRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [showPaymentModal]);

  // ── Derived ──────────────────────────────────────────────────────
  const categories = ["todos", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
  const visibleProducts = activeCategory === "todos"
    ? products
    : products.filter((p) => p.category === activeCategory);

  const subtotal     = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const ivaAmt       = ivaEnabled     ? Math.round(subtotal * ivaRate     / 100) : 0;
  const serviceAmt   = serviceEnabled ? Math.round(subtotal * serviceRate / 100) : 0;
  const tipAmt       = tipEnabled     ? tipAmount : 0;
  const deliveryFeeAmt = orderType === "EXPRESS" ? deliveryFee : 0;
  const total        = subtotal + ivaAmt + serviceAmt + tipAmt + deliveryFeeAmt;
  const mixedSum     = mixedAmounts.efectivo + mixedAmounts.sinpe + mixedAmounts.tarjeta;
  const mixedRemainder = total - mixedSum;
  const cashPortion    = paymentMethod === "efectivo" ? total : mixedAmounts.efectivo;
  const needsChangeCalc = paymentMethod === "efectivo" || (paymentMethod === "mixto" && mixedAmounts.efectivo > 0);
  const change         = amountPaid - cashPortion;

  // ── Handlers ─────────────────────────────────────────────────────
  function selectCashUser(u: CashUser) {
    setCashUser(u);
    localStorage.setItem("pos_cashUser", JSON.stringify(u));
    setShowUserPicker(false);
  }

  function changeOrderType(type: OrderType) {
    setOrderType(type);
    if (type !== "PICKUP")  setPickupTime("");
    if (type !== "EXPRESS") { setDeliveryAddress(""); setDeliveryPhone(""); setDeliveryFee(0); }
  }

  function openQtyModal(product: ProductRow) {
    setQtyModal(product);
    setQtyInput(1);
  }

  function addToCart() {
    if (!qtyModal || qtyInput < 1) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === qtyModal._id);
      if (existing) {
        return prev.map((l) =>
          l.productId === qtyModal._id
            ? { ...l, quantity: l.quantity + qtyInput }
            : l
        );
      }
      return [...prev, {
        productId:   qtyModal._id,
        productName: qtyModal.name,
        unitPrice:   qtyModal.price,
        quantity:    qtyInput,
      }];
    });
    setQtyModal(null);
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => l.productId === productId ? { ...l, quantity: l.quantity + delta } : l)
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  async function saveRatesConfig() {
    await fetch("/api/admin/pos-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ivaRate, serviceRate }),
    });
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

  async function registerSale() {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const items = cart.map((l) => ({
        productId:   l.productId,
        productName: l.productName,
        unitPrice:   l.unitPrice,
        quantity:    l.quantity,
        lineTotal:   l.unitPrice * l.quantity,
      }));
      const res = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashUserId:     cashUser?._id  ?? "",
          cashUserName:   cashUser?.name ?? "",
          customerName,
          tableNumber,
          notes: observaciones,
          items,
          subtotal,
          ivaEnabled,
          ivaRate,
          ivaAmount:      ivaAmt,
          serviceEnabled,
          serviceRate,
          serviceAmount:  serviceAmt,
          tipEnabled,
          tipAmount:      tipAmt,
          total,
          paymentMethod,
          mixedPayment:   paymentMethod === "mixto" ? mixedAmounts : undefined,
          orderType,
          pickupTime:     orderType === "PICKUP"  ? pickupTime  : undefined,
          deliveryAddress: orderType === "EXPRESS" ? deliveryAddress : undefined,
          deliveryPhone:  orderType === "EXPRESS" ? deliveryPhone  : undefined,
          deliveryFee:    orderType === "EXPRESS" ? deliveryFeeAmt : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const s = data.sale;
        const saleNumber = String(s._id).slice(-6).toUpperCase();
        setLastSaleNum(saleNumber);
        setLastSaleTicket({
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
        });
        setShowSuccess(true);
        setCart([]);
        setTipAmount(0);
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
        localStorage.removeItem(DRAFT_KEY);
        window.dispatchEvent(new CustomEvent("pos-cart-update"));
        setTimeout(() => setShowSuccess(false), 10000);
      }
    } finally {
      setSaving(false);
    }
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
        <div className="relative" ref={userPickerRef}>
          <button
            type="button"
            onClick={() => setShowUserPicker((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              cashUser
                ? "border-brand-pink/40 bg-brand-pink/5 text-brand-pink"
                : "border-brand-muted text-brand-dark/50 hover:border-brand-pink/40"
            }`}
          >
            <span className="text-base">🧑‍💼</span>
            <span>{cashUser ? cashUser.name : "Seleccionar encargado"}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
          {showUserPicker && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-brand-muted shadow-lg z-50 min-w-[180px] py-1">
              {cashUsers.length === 0 ? (
                <p className="text-xs text-brand-dark/40 px-3 py-2">
                  Sin usuarios — agregalos en Configuración → Caja
                </p>
              ) : (
                cashUsers.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => selectCashUser(u)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-brand-muted/20 text-left"
                  >
                    {u.name}
                    {cashUser?._id === u._id && <Check className="w-3.5 h-3.5 text-brand-pink" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Body: dos columnas ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Columna izquierda: Catálogo ── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-brand-muted pb-20 lg:pb-0">
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
                <p className="text-sm">Sin productos en esta categoría</p>
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
            <OrderTypeSelector value={orderType} onChange={changeOrderType} />
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
                onChange={setTableNumber}
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
                <div key={line.productId} className="bg-white rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-gray-900 leading-tight flex-1">{line.productName}</p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(line.productId, -1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(line.productId, 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-brand-pink">
                      {fmt(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                  {line.quantity > 1 && (
                    <p className="text-xs text-gray-400 mt-1">{fmt(line.unitPrice)} c/u</p>
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

            {/* IVA */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setIvaEnabled((v) => !v); }}
                  onBlur={saveRatesConfig}
                  style={{ background: ivaEnabled ? "var(--color-brand-pink)" : "#d1d5db" }}
                  className="relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none"
                >
                  <div
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200"
                    style={{ left: ivaEnabled ? "22px" : "2px" }}
                  />
                </button>
                <span className="text-sm text-gray-600">IVA</span>
                <input
                  type="number"
                  min={0} max={100} step={0.5}
                  value={ivaRate}
                  disabled={!ivaEnabled}
                  onChange={(e) => setIvaRate(Number(e.target.value))}
                  onBlur={saveRatesConfig}
                  className="w-9 text-center text-sm font-semibold bg-transparent border-b border-gray-300 focus:outline-none disabled:opacity-30"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <span className={`text-sm font-semibold ${ivaEnabled ? "text-gray-800" : "text-gray-300"}`}>
                {fmt(ivaAmt)}
              </span>
            </div>

            {/* Servicio */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setServiceEnabled((v) => !v); }}
                  onBlur={saveRatesConfig}
                  style={{ background: serviceEnabled ? "var(--color-brand-pink)" : "#d1d5db" }}
                  className="relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none"
                >
                  <div
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200"
                    style={{ left: serviceEnabled ? "22px" : "2px" }}
                  />
                </button>
                <span className="text-sm text-gray-600">Servicio</span>
                <input
                  type="number"
                  min={0} max={100} step={0.5}
                  value={serviceRate}
                  disabled={!serviceEnabled}
                  onChange={(e) => setServiceRate(Number(e.target.value))}
                  onBlur={saveRatesConfig}
                  className="w-9 text-center text-sm font-semibold bg-transparent border-b border-gray-300 focus:outline-none disabled:opacity-30"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <span className={`text-sm font-semibold ${serviceEnabled ? "text-gray-800" : "text-gray-300"}`}>
                {fmt(serviceAmt)}
              </span>
            </div>

            {/* Propina */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setTipEnabled((v) => !v); }}
                  onBlur={saveRatesConfig}
                  style={{ background: tipEnabled ? "var(--color-brand-pink)" : "#d1d5db" }}
                  className="relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none"
                >
                  <div
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200"
                    style={{ left: tipEnabled ? "22px" : "2px" }}
                  />
                </button>
                <span className="text-sm text-gray-600">Propina</span>
              </div>
              {tipEnabled ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">₡</span>
                  <input
                    type="number"
                    min={0}
                    value={tipAmount}
                    onChange={(e) => setTipAmount(Number(e.target.value))}
                    className="w-20 text-right border border-gray-200 rounded-lg px-2 py-0.5 text-sm font-semibold focus:outline-none focus:border-brand-pink"
                  />
                </div>
              ) : (
                <span className="text-sm font-semibold text-gray-300">{fmt(0)}</span>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
              <span>Total</span>
              <span className="text-brand-pink text-lg">{fmt(total)}</span>
            </div>

            {/* Método de pago */}
            <div className="grid grid-cols-2 gap-1.5">
              {(["efectivo", "sinpe", "tarjeta", "mixto"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m);
                    if (m === "mixto") {
                      setMixedAmounts({ efectivo: total, sinpe: 0, tarjeta: 0 });
                      setShowMixedModal(true);
                    }
                  }}
                  className={`py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    paymentMethod === m
                      ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                      : "border-brand-muted text-brand-dark/40 hover:border-brand-pink/40"
                  }`}
                >
                  {m === "efectivo" ? "💵 Efectivo" : m === "sinpe" ? "📱 SINPE" : m === "tarjeta" ? "💳 Tarjeta" : "🔀 Mixto"}
                </button>
              ))}
            </div>

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
                ¡Venta registrada! <span className="font-mono font-bold">#{lastSaleNum}</span>
              </div>
            )}

            {/* Imprimir / Descargar PDF (persistente) */}
            {lastSaleTicket && (
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                onClick={() => saleTicket(lastSaleTicket, ticketConfig)}
              >
                <Printer className="w-4 h-4" /> Imprimir / Descargar PDF
              </Button>
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
            <OrderTypeSelector value={orderType} onChange={changeOrderType} />
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
                onChange={setTableNumber}
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
                <div key={line.productId} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-gray-900 leading-tight flex-1">{line.productName}</p>
                    <button type="button" onClick={() => removeLine(line.productId)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQty(line.productId, -1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                      <button type="button" onClick={() => updateQty(line.productId, 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-brand-pink">{fmt(line.unitPrice * line.quantity)}</span>
                  </div>
                  {line.quantity > 1 && <p className="text-xs text-gray-400 mt-1">{fmt(line.unitPrice)} c/u</p>}
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
            {/* IVA */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIvaEnabled((v) => !v)} onBlur={saveRatesConfig}
                  style={{ background: ivaEnabled ? "var(--color-brand-pink)" : "#d1d5db" }}
                  className="relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none">
                  <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200" style={{ left: ivaEnabled ? "22px" : "2px" }} />
                </button>
                <span className="text-sm text-gray-600">IVA</span>
                <input type="number" min={0} max={100} step={0.5} value={ivaRate} disabled={!ivaEnabled}
                  onChange={(e) => setIvaRate(Number(e.target.value))} onBlur={saveRatesConfig}
                  className="w-9 text-center text-sm font-semibold bg-transparent border-b border-gray-300 focus:outline-none disabled:opacity-30" />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <span className={`text-sm font-semibold ${ivaEnabled ? "text-gray-800" : "text-gray-300"}`}>{fmt(ivaAmt)}</span>
            </div>
            {/* Servicio */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setServiceEnabled((v) => !v)} onBlur={saveRatesConfig}
                  style={{ background: serviceEnabled ? "var(--color-brand-pink)" : "#d1d5db" }}
                  className="relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none">
                  <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200" style={{ left: serviceEnabled ? "22px" : "2px" }} />
                </button>
                <span className="text-sm text-gray-600">Servicio</span>
                <input type="number" min={0} max={100} step={0.5} value={serviceRate} disabled={!serviceEnabled}
                  onChange={(e) => setServiceRate(Number(e.target.value))} onBlur={saveRatesConfig}
                  className="w-9 text-center text-sm font-semibold bg-transparent border-b border-gray-300 focus:outline-none disabled:opacity-30" />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <span className={`text-sm font-semibold ${serviceEnabled ? "text-gray-800" : "text-gray-300"}`}>{fmt(serviceAmt)}</span>
            </div>
            {/* Propina */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setTipEnabled((v) => !v)} onBlur={saveRatesConfig}
                  style={{ background: tipEnabled ? "var(--color-brand-pink)" : "#d1d5db" }}
                  className="relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none">
                  <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200" style={{ left: tipEnabled ? "22px" : "2px" }} />
                </button>
                <span className="text-sm text-gray-600">Propina</span>
              </div>
              {tipEnabled ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">₡</span>
                  <input type="number" min={0} value={tipAmount} onChange={(e) => setTipAmount(Number(e.target.value))}
                    className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:border-brand-pink" />
                </div>
              ) : (
                <span className="text-sm font-semibold text-gray-300">{fmt(0)}</span>
              )}
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
              <span>Total</span>
              <span className="text-brand-pink text-lg">{fmt(total)}</span>
            </div>
            {/* Métodos de pago */}
            <div className="grid grid-cols-2 gap-1.5">
              {(["efectivo", "sinpe", "tarjeta", "mixto"] as const).map((m) => (
                <button key={m} type="button"
                  onClick={() => {
                    setPaymentMethod(m);
                    if (m === "mixto") { setMixedAmounts({ efectivo: total, sinpe: 0, tarjeta: 0 }); setShowMixedModal(true); }
                  }}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${paymentMethod === m ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/40 hover:border-brand-pink/40"}`}>
                  {m === "efectivo" ? "💵 Efectivo" : m === "sinpe" ? "📱 SINPE" : m === "tarjeta" ? "💳 Tarjeta" : "🔀 Mixto"}
                </button>
              ))}
            </div>
            <Button className="w-full py-3 text-base" disabled={cart.length === 0 || saving} onClick={openPaymentModal}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? "Registrando..." : "Registrar venta"}
            </Button>
            {showSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-700">
                <Check className="w-4 h-4 shrink-0" />
                ¡Venta registrada! <span className="font-mono font-bold">#{lastSaleNum}</span>
              </div>
            )}

            {/* Imprimir / Descargar PDF (persistente) */}
            {lastSaleTicket && (
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                onClick={() => saleTicket(lastSaleTicket, ticketConfig)}
              >
                <Printer className="w-4 h-4" /> Imprimir / Descargar PDF
              </Button>
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
              {paymentMethod !== "efectivo" && (
                <p className="text-xs text-gray-400 mt-1">
                  {paymentMethod === "sinpe" ? "📱 SINPE" : paymentMethod === "tarjeta" ? "💳 Tarjeta" : "🔀 Mixto"}
                  {paymentMethod === "mixto" && mixedAmounts.efectivo > 0 && (
                    <span className="ml-1">· efectivo {fmt(mixedAmounts.efectivo)}</span>
                  )}
                </p>
              )}
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

            {/* Acciones */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
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
            {(["efectivo", "sinpe", "tarjeta"] as const).map((m) => (
              <div key={m} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-20 shrink-0">
                  {m === "efectivo" ? "💵 Efectivo" : m === "sinpe" ? "📱 SINPE" : "💳 Tarjeta"}
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
            ))}
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
      <Dialog open={!!qtyModal} onOpenChange={(open) => !open && setQtyModal(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">{qtyModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-2">
            <p className="text-brand-pink font-bold text-lg">{qtyModal ? fmt(qtyModal.price) : ""}</p>
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
              Subtotal: <span className="font-bold text-gray-700">{qtyModal ? fmt(qtyModal.price * qtyInput) : ""}</span>
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
    </div>
  );
}
