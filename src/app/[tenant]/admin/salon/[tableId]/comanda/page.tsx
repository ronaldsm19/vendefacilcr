"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft, ChevronDown, Search, Plus, Minus, StickyNote, Loader2, CheckCheck, CopyPlus, Trash2, UtensilsCrossed, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "@/components/admin/SessionContext";
import { usePolling } from "@/hooks/usePolling";
import { TABLE_STATUS_META, type TableStatus } from "@/lib/tableStatus";
import { DEFAULT_COMANDA_CONFIG, type ComandaConfigData } from "@/lib/comandaConfig";
import type { ProductStation } from "@/lib/station";
import ComandaCard, { type ComandaRow } from "@/components/admin/ComandaCard";
import CancelComandaDialog from "@/components/admin/CancelComandaDialog";
import ServeAllDialog from "@/components/admin/ServeAllDialog";
import { orderCategories, type CategoryOrderEntry } from "@/lib/categories";
import {
  extraLabel, extraQty, extrasKey, extrasTotal, lineTotal, subtotalOf, MAX_EXTRA_QTY, type LineExtra,
} from "@/lib/pricing";

interface CatalogProduct {
  _id: string;
  name: string;
  price: number;
  category: string;
  station: ProductStation;
  image?: string;
  extras?: LineExtra[];
}

interface LiveTable {
  _id: string;
  areaId: string;
  label: string;
  shape: string;
  status: TableStatus;
  statusNote: string;
}

interface ComandaLine {
  key: string;
  productId: string;
  productName: string;
  unitPrice: number;
  station: ProductStation;
  quantity: number;
  note: string;
  extras: LineExtra[];   // aplican a toda la línea; platos con otros extras u otra nota van en otra línea
}

/** Un plato en la hoja inferior: sus extras (con porciones) y su nota. */
interface PlateDraft {
  id: string;
  extras: LineExtra[];
  note: string;
}

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR")}`;
}

export default function TomarComandaPage() {
  const params = useParams();
  const tableId = String(params.tableId);
  const pathname = usePathname();
  const slug = pathname.split("/")[1];
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { isPremium } = useAdminSession();

  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<LiveTable | null>(null);
  const [areaName, setAreaName] = useState("");
  const [comandaConfig, setComandaConfig] = useState<ComandaConfigData>(DEFAULT_COMANDA_CONFIG);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<CategoryOrderEntry[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [openComandas, setOpenComandas] = useState<ComandaRow[]>([]);

  const [tab, setTab] = useState<"new" | "open">("new");
  const [customerName, setCustomerName] = useState("");
  const [notesText, setNotesText] = useState("");
  const [lines, setLines] = useState<ComandaLine[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todas");

  const [editVersion, setEditVersion] = useState<number | null>(null);
  const [editNumber, setEditNumber] = useState<number | null>(null);
  const [editBlocked, setEditBlocked] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [versionConflict, setVersionConflict] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ComandaRow | null>(null);
  const [showServeAll, setShowServeAll] = useState(false);

  // Toma con una mano: lo elegido arriba (plegable), hoja inferior para editar un producto plato
  // por plato. La hoja trabaja sobre un borrador y lo aplica al cerrarse.
  const [linesOpen, setLinesOpen] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [sheetProductId, setSheetProductId] = useState<string | null>(null);
  const [plates, setPlates] = useState<PlateDraft[]>([]);
  const [openPlateId, setOpenPlateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPremium) { setLoading(false); return; }
    setLoading(true);
    const [liveRes, catalogRes, categoriesRes, nextRes, openRes] = await Promise.all([
      fetch("/api/admin/salon/live").then((r) => r.json()),
      fetch("/api/admin/comandas/catalog").then((r) => r.json()),
      fetch("/api/admin/categories").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/comandas/next-number").then((r) => r.json()),
      fetch(`/api/admin/comandas?tableId=${tableId}&open=1&limit=50`).then((r) => r.json()),
    ]);
    const foundTable = (liveRes.tables ?? []).find((t: LiveTable) => t._id === tableId) ?? null;
    setTable(foundTable);
    const area = (liveRes.areas ?? []).find((a: { _id: string; name: string }) => a._id === foundTable?.areaId);
    setAreaName(area?.name ?? "");
    setComandaConfig(liveRes.comandaConfig ?? DEFAULT_COMANDA_CONFIG);
    setCatalog(catalogRes.products ?? []);
    setCategoryOrder(categoriesRes.categories ?? []);
    setNextNumber(nextRes.nextNumber ?? 1);
    const open = openRes.comandas ?? [];
    setOpenComandas(open);
    if (!editId && open.length > 0) setTab("open");
    setLoading(false);
  }, [tableId, isPremium, editId]);

  useEffect(() => { load(); }, [load]);

  /**
   * Cierra la hoja aplicando el borrador: los platos iguales (mismos extras y nota) se juntan en una
   * línea y las líneas del producto quedan donde estaba la primera. Sin platos, el producto se quita.
   */
  const closeSheet = useCallback(() => {
    if (!sheetProductId) return;
    const base = lines.find((l) => l.productId === sheetProductId);
    if (base) {
      const grouped: ComandaLine[] = [];
      for (const p of plates) {
        const key = `${extrasKey(p.extras)}|${p.note.trim()}`;
        const same = grouped.find((g) => `${extrasKey(g.extras)}|${g.note.trim()}` === key);
        if (same) same.quantity += 1;
        else grouped.push({ ...base, key: crypto.randomUUID(), quantity: 1, note: p.note, extras: p.extras });
      }
      setLines((prev) => {
        const at = prev.findIndex((l) => l.productId === sheetProductId);
        const rest = prev.filter((l) => l.productId !== sheetProductId);
        return [...rest.slice(0, at), ...grouped, ...rest.slice(at)];
      });
    }
    setSheetProductId(null);
    setPlates([]);
    setOpenPlateId(null);
  }, [sheetProductId, plates, lines]);

  // Escape cierra la hoja inferior (y aplica lo editado, igual que "Listo").
  useEffect(() => {
    if (!sheetProductId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetProductId, closeSheet]);

  const refreshOpen = useCallback(async () => {
    const r = await fetch(`/api/admin/comandas?tableId=${tableId}&open=1&limit=50`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setOpenComandas(d.comandas ?? []);
  }, [tableId]);

  usePolling(refreshOpen, 4000, isPremium && !loading && tab === "open");

  // ── Modo edición ──────────────────────────────────────────────────
  useEffect(() => {
    if (!editId || !isPremium) {
      setEditVersion(null);
      setEditNumber(null);
      setEditBlocked(null);
      return;
    }
    setEditLoading(true);
    setSuccessMsg("");
    fetch(`/api/admin/comandas/${editId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.comanda) { setEditBlocked("No se pudo cargar la comanda."); return; }
        const c: ComandaRow = d.comanda;
        const isOpen = c.status === "enviada" || c.status === "servida";
        const hasPaid = c.items.some((i) => i.paidQty > 0);
        if (!isOpen || hasPaid) {
          setEditBlocked(hasPaid ? "La comanda tiene ítems cobrados y no se puede editar." : "La comanda ya no está abierta.");
          return;
        }
        setEditBlocked(null);
        setEditVersion(c.version);
        setEditNumber(c.number);
        setCustomerName(c.customerName ?? "");
        setNotesText(c.notes ?? "");
        setLines(c.items.map((i) => ({
          key: crypto.randomUUID(),
          productId: i.productId,
          productName: i.productName,
          unitPrice: i.unitPrice,
          station: i.station,
          quantity: i.quantity,
          note: i.note ?? "",
          extras: i.extras ?? [],
        })));
        setTab("new");
      })
      .finally(() => setEditLoading(false));
  }, [editId, isPremium]);

  /** Línea "simple" de un producto: sin extras ni nota. Ahí van los + y − de la tarjeta. */
  const isPlainLine = (l: ComandaLine) => l.extras.length === 0 && !l.note.trim();

  // Sumar desde el catálogo va a la línea simple del producto; las personalizadas no se tocan.
  function incrementCatalog(p: CatalogProduct) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p._id && isPlainLine(l));
      if (idx === -1) {
        return [...prev, { key: crypto.randomUUID(), productId: p._id, productName: p.name, unitPrice: p.price, station: p.station, quantity: 1, note: "", extras: [] }];
      }
      return prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l));
    });
  }
  /** Una unidad menos: primero de la línea simple; si no hay, de la última personalizada. */
  function decrementCatalog(productId: string) {
    setLines((prev) => {
      let idx = prev.findIndex((l) => l.productId === productId && isPlainLine(l));
      if (idx === -1) idx = prev.findLastIndex((l) => l.productId === productId);
      if (idx === -1) return prev;
      if (prev[idx].quantity <= 1) return prev.filter((_, i) => i !== idx);
      return prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity - 1 } : l));
    });
  }
  /** Tocar la tarjeta: si no está, agrega 1; si ya está, lo quita (confirma si tiene extras o notas). */
  function toggleCatalog(p: CatalogProduct) {
    const own = lines.filter((l) => l.productId === p._id);
    if (own.length === 0) { incrementCatalog(p); return; }
    const customized = own.some((l) => !isPlainLine(l));
    if (customized && !window.confirm(`¿Quitar ${p.name} de la comanda? Tiene extras o notas que se van a perder.`)) return;
    setLines((prev) => prev.filter((l) => l.productId !== p._id));
  }
  function quantityFor(productId: string): number {
    return lines.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);
  }
  // ── Hoja inferior: un producto, plato por plato ───────────────────
  /** Abre la hoja con un plato por cada unidad de ese producto en la comanda. */
  function openSheet(productId: string) {
    const drafts = lines
      .filter((l) => l.productId === productId)
      .flatMap((l) => Array.from({ length: l.quantity }, () => ({
        id: crypto.randomUUID(),
        extras: l.extras.map((e) => ({ ...e })),
        note: l.note,
      })));
    setPlates(drafts);
    setOpenPlateId(drafts[0]?.id ?? null);
    setSheetProductId(productId);
  }
  function updatePlate(id: string, fn: (p: PlateDraft) => PlateDraft) {
    setPlates((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }
  /** Porciones de un extra en un plato; 0 lo saca. */
  function setPlateExtraQty(id: string, extra: LineExtra, qty: number) {
    const q = Math.min(MAX_EXTRA_QTY, Math.max(0, qty));
    updatePlate(id, (p) => {
      const has = p.extras.some((e) => e.name === extra.name);
      const extras = q === 0
        ? p.extras.filter((e) => e.name !== extra.name)
        : has
          ? p.extras.map((e) => (e.name === extra.name ? { ...e, qty: q } : e))
          : [...p.extras, { name: extra.name, price: extra.price, qty: q }];
      return { ...p, extras };
    });
  }
  function addPlate() {
    if (plates.length >= 99) return;
    const id = crypto.randomUUID();
    setPlates((prev) => [...prev, { id, extras: [], note: "" }]);
    setOpenPlateId(id);
  }
  function removePlate(id: string) {
    setPlates((prev) => prev.filter((p) => p.id !== id));
    if (openPlateId === id) setOpenPlateId(null);
  }
  /** Pone los extras y la nota de este plato en todos los platos del producto. */
  function copyPlateToAll(id: string) {
    const src = plates.find((p) => p.id === id);
    if (!src) return;
    setPlates((prev) => prev.map((p) => ({ ...p, extras: src.extras.map((e) => ({ ...e })), note: src.note })));
  }
  /** Saca el producto entero de la comanda. */
  function removeSheetProduct() {
    setLines((prev) => prev.filter((l) => l.productId !== sheetProductId));
    setSheetProductId(null);
    setPlates([]);
    setOpenPlateId(null);
  }

  function resetForm() {
    setLines([]);
    setCustomerName("");
    setNotesText("");
  }

  function exitEdit() {
    router.push(`/${slug}/admin/salon/${tableId}/comanda`);
  }

  async function handleSubmit() {
    if (lines.length === 0 || saving) return;
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    setVersionConflict(false);
    try {
      const payload = {
        tableId,
        customerName: customerName.trim(),
        // Los extras viajan por nombre y porciones: el precio lo congela el servidor desde el catálogo.
        items: lines.map((l) => ({
          productId: l.productId, quantity: l.quantity, note: l.note,
          extras: l.extras.map((e) => ({ name: e.name, qty: extraQty(e) })),
        })),
        notes: notesText.trim(),
      };
      const res = editId
        ? await fetch(`/api/admin/comandas/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, version: editVersion }),
          })
        : await fetch("/api/admin/comandas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && typeof data.error === "string" && data.error.includes("modificada")) {
          setVersionConflict(true);
        }
        setErrorMsg(data.error ?? "No se pudo guardar la comanda");
        return;
      }
      setSuccessMsg(`Comanda #${data.comanda.number} ${editId ? "actualizada" : "enviada"}`);
      resetForm();
      await Promise.all([
        fetch("/api/admin/comandas/next-number").then((r) => r.json()).then((d) => setNextNumber(d.nextNumber ?? 1)),
        refreshOpen(),
      ]);
      setTab("open");
      if (editId) exitEdit();
    } finally {
      setSaving(false);
    }
  }

  async function reloadEdit() {
    if (!editId) return;
    setVersionConflict(false);
    setErrorMsg("");
    const d = await fetch(`/api/admin/comandas/${editId}`).then((r) => r.json());
    if (d.comanda) {
      setEditVersion(d.comanda.version);
      setLines(d.comanda.items.map((i: ComandaRow["items"][number]) => ({
        key: crypto.randomUUID(),
        productId: i.productId,
        productName: i.productName,
        unitPrice: i.unitPrice,
        station: i.station,
        quantity: i.quantity,
        note: i.note ?? "",
        extras: i.extras ?? [],
      })));
    }
  }

  async function handleServe(id: string) {
    await fetch(`/api/admin/comandas/${id}/serve`, { method: "POST" });
    await refreshOpen();
  }

  const totalItems = lines.reduce((s, l) => s + l.quantity, 0);
  const totalAmount = subtotalOf(lines);
  // Datos del producto abierto en la hoja. Si ya no está en el catálogo (p. ej. al editar), se usa
  // lo congelado en su línea; los extras a elegir son los del catálogo más los ya elegidos.
  const sheetBase = sheetProductId ? lines.find((l) => l.productId === sheetProductId) ?? null : null;
  const sheetCatalogExtras = sheetProductId ? catalog.find((p) => p._id === sheetProductId)?.extras ?? [] : [];
  const sheetExtraOptions: LineExtra[] = [...sheetCatalogExtras];
  for (const p of plates) for (const e of p.extras) {
    if (!sheetExtraOptions.some((o) => o.name === e.name)) sheetExtraOptions.push({ name: e.name, price: e.price });
  }
  const plateTotal = (p: PlateDraft) => (sheetBase?.unitPrice ?? 0) + extrasTotal(p.extras);
  const sheetTotal = plates.reduce((s, p) => s + plateTotal(p), 0);
  const pendingToServe = openComandas.filter((c) => c.status === "enviada");
  const categories = ["Todas", ...orderCategories(categoryOrder, catalog.map((p) => p.category))];
  // Con "Todas" se agrupan en el orden de las familias (Configuración → Productos); dentro de cada
  // familia queda el orden del catálogo, que ya viene por nombre (el sort es estable).
  const categoryRank = new Map(categories.map((c, i) => [c, i]));
  const visibleProducts = catalog
    .filter((p) =>
      (activeCategory === "Todas" || p.category === activeCategory) &&
      (!search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => (categoryRank.get(a.category) ?? categories.length) - (categoryRank.get(b.category) ?? categories.length));

  if (!isPremium) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-brand-dark/60">Disponible en el plan Premium</p>
        <Button onClick={() => router.push(`/${slug}/admin/salon`)}>Volver al salón</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-brand-dark/60">Mesa no encontrada</p>
        <Button onClick={() => router.push(`/${slug}/admin/salon`)}>Volver al salón</Button>
      </div>
    );
  }

  const statusMeta = TABLE_STATUS_META[table.status];

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      {/* Cabecera */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-brand-muted bg-white">
        <button onClick={() => router.push(`/${slug}/admin/salon`)} className="text-brand-dark/50 hover:text-brand-dark">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-brand text-lg font-bold text-brand-dark truncate">
            {table.shape === "barstool" ? "Banqueta" : "Mesa"} {table.label}{areaName && ` · ${areaName}`}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold shrink-0" style={{ background: statusMeta.bg }}>
          {statusMeta.label}
        </span>
        <span className="text-xs text-brand-dark/40 shrink-0">
          {editId && editNumber ? `Editando #${editNumber} · v${editVersion}` : `Próxima #${nextNumber}`}
        </span>
      </div>

      {/* Segmentado */}
      <div className="shrink-0 flex items-center gap-1 p-2 bg-white border-b border-brand-muted">
        <div className="flex-1 flex items-center gap-1 p-0.5 rounded-xl bg-gray-100">
          <button onClick={() => setTab("new")}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "new" ? "bg-white shadow text-brand-dark" : "text-brand-dark/50"}`}>
            {editId ? `Editar #${editNumber ?? ""}` : "Nueva comanda"}
          </button>
          <button onClick={() => setTab("open")}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "open" ? "bg-white shadow text-brand-dark" : "text-brand-dark/50"}`}>
            Abiertas ({openComandas.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "new" ? (
          editLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-brand-pink" /></div>
          ) : editBlocked ? (
            <div className="p-6 text-center space-y-4">
              <p className="text-brand-dark/60">{editBlocked}</p>
              <Button onClick={exitEdit}>Volver</Button>
            </div>
          ) : (
            <div className="pb-4">
              {/* Arriba y siempre a mano: lo elegido (plegable), búsqueda y familias */}
              <div className="sticky top-0 z-10 bg-white border-b border-brand-muted shadow-sm">
                <div className="px-4 pt-3">
                  <button
                    type="button"
                    onClick={() => setLinesOpen((o) => !o)}
                    aria-expanded={linesOpen}
                    aria-controls="comanda-lineas"
                    className="w-full flex items-center justify-between gap-2 py-1 text-left"
                  >
                    <span className="text-sm font-semibold text-brand-dark">
                      {lines.length === 0
                        ? "Tocá un producto para agregarlo"
                        : `${totalItems} ítem${totalItems !== 1 ? "s" : ""} · ${fmt(totalAmount)}`}
                    </span>
                    {lines.length > 0 && (
                      <ChevronDown className={`w-4 h-4 text-brand-dark/50 transition-transform ${linesOpen ? "rotate-180" : ""}`} />
                    )}
                  </button>
                  {linesOpen && lines.length > 0 && (
                    <ul id="comanda-lineas" className="mt-1 max-h-[30vh] overflow-y-auto space-y-1.5 pb-1">
                      {lines.map((l) => (
                        <li key={l.key}>
                          <button
                            type="button"
                            onClick={() => openSheet(l.productId)}
                            className="w-full flex items-start gap-2 rounded-xl border border-brand-muted bg-gray-50 px-3 py-2 text-left active:bg-gray-100"
                          >
                            <span className="text-sm font-bold text-brand-dark w-7 shrink-0">{l.quantity}×</span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-brand-dark truncate">{l.productName}</span>
                              {l.extras.length > 0 && (
                                <span className="block text-xs text-brand-dark/60 truncate">
                                  {l.extras.map((e) => `+ ${extraLabel(e)}`).join(" · ")}
                                </span>
                              )}
                              {l.note && <span className="block text-xs text-brand-dark/50 italic truncate">{l.note}</span>}
                            </span>
                            <span className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-xs font-semibold text-brand-pink">{fmt(lineTotal(l))}</span>
                              <Pencil className="w-3.5 h-3.5 text-brand-dark/40" aria-hidden />
                              <span className="sr-only">Editar extras y notas</span>
                            </span>
                          </button>
                        </li>
                      ))}
                      <li className="text-[11px] text-brand-dark/45 px-1">Tocá un producto para agregarle extras o notas para cocina.</li>
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    aria-expanded={showDetails}
                    className="flex items-center gap-1 py-1 text-xs font-medium text-brand-pink"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    {customerName.trim() ? `Cliente: ${customerName.trim()}` : "Cliente y notas de la comanda"}
                    {notesText.trim() && !showDetails ? " · con notas" : ""}
                  </button>
                  {showDetails && (
                    <div className="space-y-2 pb-2">
                      <input
                        type="text"
                        placeholder="Cliente (opcional)"
                        maxLength={80}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                      />
                      <textarea
                        maxLength={500}
                        rows={2}
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Notas generales de la comanda (opcional)"
                        className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
                      />
                    </div>
                  )}
                </div>

                <div className="px-4 pb-2 pt-1 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-dark/30" />
                    <input
                      type="search"
                      placeholder="Buscar producto..."
                      aria-label="Buscar producto"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-brand-muted rounded-xl text-sm focus:outline-none focus:border-brand-pink"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                    {categories.map((c) => (
                      <button key={c} type="button" onClick={() => setActiveCategory(c)}
                        aria-pressed={activeCategory === c}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border-2 transition-all ${
                          activeCategory === c ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 pt-3 space-y-3">
                {table.status === "por_limpiar" && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2 text-sm">
                    Esta mesa está marcada por limpiar
                  </div>
                )}
                {successMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-700">{successMsg}</div>
                )}
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 space-y-2">
                    <p>{errorMsg}</p>
                    {versionConflict && (
                      <Button size="sm" variant="secondary" onClick={reloadEdit}>Recargar</Button>
                    )}
                  </div>
                )}

                {/* Catálogo: el primer toque agrega 1; con el producto ya agregado, tocar la tarjeta
                    lo quita y la cantidad se ajusta con − / + abajo a la derecha. */}
                {visibleProducts.length === 0 ? (
                  <p className="text-center text-sm text-brand-dark/40 py-6">
                    {catalog.length === 0 ? "No hay productos disponibles. Agregalos en Productos." : "Sin resultados."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {visibleProducts.map((p) => {
                      const qty = quantityFor(p._id);
                      return (
                        <div
                          key={p._id}
                          className={`relative bg-white rounded-xl border overflow-hidden ${
                            qty > 0 ? "border-brand-pink ring-1 ring-brand-pink" : "border-brand-muted"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCatalog(p)}
                            aria-pressed={qty > 0}
                            aria-label={qty > 0 ? `Quitar ${p.name} (llevás ${qty})` : `Agregar ${p.name}`}
                            className="block w-full text-left transition active:scale-[0.97]"
                          >
                            <div className="relative h-20 bg-gray-100">
                              {p.image ? (
                                <Image src={p.image} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 220px" />
                              ) : (
                                <div className="h-full flex items-center justify-center text-gray-300">
                                  <UtensilsCrossed className="w-6 h-6" aria-hidden />
                                </div>
                              )}
                            </div>
                            <div className="px-2.5 pt-2 pb-2.5">
                              <p className="text-sm font-medium text-brand-dark leading-tight line-clamp-2 min-h-[2.5em]">{p.name}</p>
                              <p className="text-xs font-semibold text-brand-pink mt-1 h-8 flex items-center">{fmt(p.price)}</p>
                            </div>
                          </button>
                          {qty > 0 && (
                            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => decrementCatalog(p._id)}
                                aria-label={`Uno menos de ${p.name}`}
                                className="w-8 h-8 rounded-full border-2 border-brand-pink bg-white text-brand-pink flex items-center justify-center active:scale-90 transition"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="min-w-5 text-center text-sm font-bold text-brand-dark" aria-live="polite">{qty}</span>
                              <button
                                type="button"
                                onClick={() => incrementCatalog(p)}
                                aria-label={`Uno más de ${p.name}`}
                                className="w-8 h-8 rounded-full bg-brand-pink text-white flex items-center justify-center active:scale-90 transition"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {editId && (
                  <Button variant="cancel" size="sm" onClick={exitEdit}>Cancelar edición</Button>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="p-4 space-y-3 pb-24">
            {pendingToServe.length > 1 && (
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => setShowServeAll(true)}>
                  <CheckCheck className="w-3.5 h-3.5 mr-1" /> Servir todas ({pendingToServe.length})
                </Button>
              </div>
            )}
            {openComandas.length === 0 ? (
              <p className="text-center text-sm text-brand-dark/40 py-6">Sin comandas abiertas en esta mesa</p>
            ) : (
              openComandas.map((c) => (
                <ComandaCard
                  key={c._id}
                  comanda={c}
                  thresholds={comandaConfig}
                  now={new Date()}
                  onEdit={() => router.push(`/${slug}/admin/salon/${tableId}/comanda?edit=${c._id}`)}
                  onServe={c.status === "enviada" ? () => handleServe(c._id) : undefined}
                  onCancel={() => setCancelTarget(c)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {tab === "new" && !editBlocked && !editLoading && (
        <div className="shrink-0 bg-white border-t border-brand-muted px-4 py-3">
          <Button className="w-full" disabled={lines.length === 0 || saving} onClick={handleSubmit}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                {editId ? "Guardar cambios" : "Enviar comanda"}
                {lines.length > 0 && <span className="font-bold">· {fmt(totalAmount)}</span>}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Hoja inferior: un producto, plato por plato (extras con porciones y nota de cada uno) */}
      {sheetProductId && sheetBase && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/40" onClick={closeSheet} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="linea-titulo"
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="mx-auto -mt-2 h-1.5 w-10 rounded-full bg-gray-200" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p id="linea-titulo" className="font-brand text-lg font-bold text-brand-dark leading-tight">{sheetBase.productName}</p>
                <p className="text-sm text-brand-dark/50">{fmt(sheetBase.unitPrice)} c/u</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-brand-dark/70">
                {plates.length} plato{plates.length !== 1 ? "s" : ""}
              </span>
            </div>

            {plates.length === 0 && (
              <p className="text-sm text-brand-dark/50">Sin platos: al tocar Listo se quita de la comanda.</p>
            )}

            <div className="space-y-2">
              {plates.map((p, i) => {
                const open = openPlateId === p.id;
                const summary = [
                  ...p.extras.map((e) => `+ ${extraLabel(e)}`),
                  ...(p.note.trim() ? [p.note.trim()] : []),
                ].join(" · ") || "Sin extras";
                return (
                  <div key={p.id} className={`rounded-xl border ${open ? "border-brand-pink" : "border-brand-muted"}`}>
                    <button
                      type="button"
                      onClick={() => setOpenPlateId(open ? null : p.id)}
                      aria-expanded={open}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                    >
                      <span className="text-sm font-semibold text-brand-dark shrink-0">Plato {i + 1}</span>
                      <span className="flex-1 min-w-0 text-xs text-brand-dark/50 truncate">{summary}</span>
                      <span className="text-sm font-semibold text-brand-pink shrink-0">{fmt(plateTotal(p))}</span>
                      <ChevronDown className={`w-4 h-4 text-brand-dark/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>

                    {open && (
                      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-brand-muted">
                        {sheetExtraOptions.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            {sheetExtraOptions.map((e) => {
                              const qty = extraQty(p.extras.find((x) => x.name === e.name) ?? { qty: 0 });
                              return (
                                <div key={e.name} className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border text-sm ${
                                  qty > 0 ? "border-brand-pink bg-brand-pink/10" : "border-brand-muted"
                                }`}>
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-brand-dark">{e.name}</span>
                                    <span className="block text-xs text-brand-dark/50">{e.price > 0 ? `+${fmt(e.price)} c/u` : "Sin costo"}</span>
                                  </span>
                                  {qty === 0 ? (
                                    <button type="button" onClick={() => setPlateExtraQty(p.id, e, 1)}
                                      aria-label={`Agregar ${e.name} al plato ${i + 1}`}
                                      className="h-9 px-3 rounded-full border border-brand-muted bg-white flex items-center gap-1 text-xs font-semibold text-brand-dark/70">
                                      <Plus className="w-3.5 h-3.5" /> Agregar
                                    </button>
                                  ) : (
                                    <span className="flex items-center gap-1.5 shrink-0">
                                      <button type="button" onClick={() => setPlateExtraQty(p.id, e, qty - 1)}
                                        aria-label={`Una porción menos de ${e.name}`}
                                        className="w-9 h-9 rounded-full border border-brand-muted bg-white flex items-center justify-center text-brand-dark/70">
                                        <Minus className="w-4 h-4" />
                                      </button>
                                      <span className="w-5 text-center font-bold" aria-live="polite">{qty}</span>
                                      <button type="button" onClick={() => setPlateExtraQty(p.id, e, qty + 1)}
                                        disabled={qty >= MAX_EXTRA_QTY}
                                        aria-label={`Una porción más de ${e.name}`}
                                        className="w-9 h-9 rounded-full border border-brand-muted bg-white flex items-center justify-center text-brand-dark/70 disabled:opacity-30">
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div>
                          <label htmlFor={`nota-${p.id}`} className="block text-xs font-semibold text-brand-dark/60 mb-1.5">Nota para cocina</label>
                          <textarea
                            id={`nota-${p.id}`}
                            rows={2}
                            maxLength={200}
                            value={p.note}
                            onChange={(ev) => updatePlate(p.id, (x) => ({ ...x, note: ev.target.value }))}
                            placeholder="Ej: sin cebolla, término medio"
                            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
                          />
                        </div>

                        {plates.length > 1 && (
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="secondary" className="flex-1" onClick={() => copyPlateToAll(p.id)}>
                              <CopyPlus className="w-4 h-4" /> Igual en todos
                            </Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => removePlate(p.id)}>
                              <Trash2 className="w-4 h-4" /> Quitar plato
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="secondary" className="w-full" onClick={addPlate} disabled={plates.length >= 99}>
              <Plus className="w-4 h-4" /> Agregar plato
            </Button>

            <p className="flex items-center justify-between text-sm">
              <span className="text-brand-dark/60">Total de {sheetBase.productName}</span>
              <span className="font-bold text-brand-pink">{fmt(sheetTotal)}</span>
            </p>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="destructive" onClick={removeSheetProduct}>Quitar todo</Button>
              <Button type="button" className="col-span-2" onClick={closeSheet}>Listo</Button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelComandaDialog
          comanda={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={() => { setCancelTarget(null); refreshOpen(); }}
        />
      )}

      {showServeAll && (
        <ServeAllDialog
          tableId={tableId}
          pending={pendingToServe}
          onClose={() => setShowServeAll(false)}
          onDone={() => { setShowServeAll(false); refreshOpen(); }}
        />
      )}
    </div>
  );
}
