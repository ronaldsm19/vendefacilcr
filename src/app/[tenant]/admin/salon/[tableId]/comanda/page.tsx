"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft, ChevronDown, Search, Plus, Minus, StickyNote, Loader2, CheckCheck, Check, CopyPlus, UtensilsCrossed,
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
import { lineTotal, subtotalOf, type LineExtra } from "@/lib/pricing";

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
  extras: LineExtra[];   // aplican a toda la línea; extras distintos van en otra línea
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

  // Toma con una mano: lo elegido arriba (plegable), hoja inferior para editar una línea.
  const [linesOpen, setLinesOpen] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [sheetKey, setSheetKey] = useState<string | null>(null);

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

  // Escape cierra la hoja inferior.
  useEffect(() => {
    if (!sheetKey) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetKey(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetKey]);

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

  // Sumar desde el catálogo va a la línea del producto SIN extras; las líneas con extras no se tocan.
  function incrementCatalog(p: CatalogProduct) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p._id && l.extras.length === 0);
      if (idx === -1) {
        return [...prev, { key: crypto.randomUUID(), productId: p._id, productName: p.name, unitPrice: p.price, station: p.station, quantity: 1, note: "", extras: [] }];
      }
      return prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l));
    });
  }
  function quantityFor(productId: string): number {
    return lines.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);
  }
  function toggleLineExtra(key: string, extra: LineExtra) {
    setLines((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const has = l.extras.some((e) => e.name === extra.name);
      return { ...l, extras: has ? l.extras.filter((e) => e.name !== extra.name) : [...l.extras, { name: extra.name, price: extra.price }] };
    }));
  }
  /** Extras que se pueden elegir en una línea: los del catálogo + los ya elegidos que hayan salido del catálogo. */
  function extraOptionsFor(line: ComandaLine): LineExtra[] {
    const fromCatalog = catalog.find((p) => p._id === line.productId)?.extras ?? [];
    return [...fromCatalog, ...line.extras.filter((e) => !fromCatalog.some((c) => c.name === e.name))];
  }
  // En la hoja inferior la cantidad no baja de 1; para sacar la línea está "Quitar".
  function updateLineQty(key: string, delta: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, Math.max(1, l.quantity + delta)) } : l)));
  }
  function updateLineNote(key: string, note: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, note } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setSheetKey(null);
  }
  /** Línea nueva del mismo producto (otros extras u otra nota); se abre en la hoja para elegirlos. */
  function duplicateLine(key: string) {
    const src = lines.find((l) => l.key === key);
    if (!src) return;
    const newKey = crypto.randomUUID();
    setLines((prev) => [...prev, { ...src, key: newKey, quantity: 1, note: "", extras: [] }]);
    setSheetKey(newKey);
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
        // Los extras viajan por nombre: el precio lo congela el servidor desde el catálogo.
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, note: l.note, extras: l.extras.map((e) => e.name) })),
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
  const sheetLine = sheetKey ? lines.find((l) => l.key === sheetKey) ?? null : null;
  const pendingToServe = openComandas.filter((c) => c.status === "enviada");
  const categories = ["Todas", ...orderCategories(categoryOrder, catalog.map((p) => p.category))];
  const visibleProducts = catalog.filter((p) =>
    (activeCategory === "Todas" || p.category === activeCategory) &&
    (!search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
  );

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
                            onClick={() => setSheetKey(l.key)}
                            className="w-full flex items-start gap-2 rounded-xl border border-brand-muted bg-gray-50 px-3 py-2 text-left active:bg-gray-100"
                          >
                            <span className="text-sm font-bold text-brand-dark w-7 shrink-0">{l.quantity}×</span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-brand-dark truncate">{l.productName}</span>
                              {l.extras.length > 0 && (
                                <span className="block text-xs text-brand-dark/60 truncate">
                                  {l.extras.map((e) => `+ ${e.name}`).join(" · ")}
                                </span>
                              )}
                              {l.note && <span className="block text-xs text-brand-dark/50 italic truncate">{l.note}</span>}
                            </span>
                            <span className="text-xs font-semibold text-brand-pink shrink-0">{fmt(lineTotal(l))}</span>
                          </button>
                        </li>
                      ))}
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

                {/* Catálogo: tocar una tarjeta suma una unidad */}
                {visibleProducts.length === 0 ? (
                  <p className="text-center text-sm text-brand-dark/40 py-6">
                    {catalog.length === 0 ? "No hay productos disponibles. Agregalos en Productos." : "Sin resultados."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {visibleProducts.map((p) => {
                      const qty = quantityFor(p._id);
                      return (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => incrementCatalog(p)}
                          aria-label={`Agregar ${p.name}${qty > 0 ? ` (llevás ${qty})` : ""}`}
                          className={`relative text-left bg-white rounded-xl border overflow-hidden transition active:scale-[0.97] ${
                            qty > 0 ? "border-brand-pink" : "border-brand-muted"
                          }`}
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
                          {qty > 0 && (
                            <span className="absolute top-1.5 right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-brand-pink text-white text-xs font-bold flex items-center justify-center shadow">
                              {qty}
                            </span>
                          )}
                          <div className="px-2.5 py-2">
                            <p className="text-sm font-medium text-brand-dark leading-tight line-clamp-2">{p.name}</p>
                            <p className="text-xs font-semibold text-brand-pink mt-0.5">{fmt(p.price)}</p>
                          </div>
                        </button>
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

      {/* Hoja inferior: cantidad, extras con precio y nota de una línea */}
      {sheetLine && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/40" onClick={() => setSheetKey(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="linea-titulo"
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="mx-auto -mt-2 h-1.5 w-10 rounded-full bg-gray-200" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p id="linea-titulo" className="font-brand text-lg font-bold text-brand-dark leading-tight">{sheetLine.productName}</p>
                <p className="text-sm text-brand-dark/50">{fmt(sheetLine.unitPrice)} c/u</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button type="button" aria-label="Una unidad menos" onClick={() => updateLineQty(sheetLine.key, -1)}
                  disabled={sheetLine.quantity <= 1}
                  className="w-11 h-11 rounded-full border border-brand-muted flex items-center justify-center text-brand-dark/70 disabled:opacity-30">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center text-lg font-bold" aria-live="polite">{sheetLine.quantity}</span>
                <button type="button" aria-label="Una unidad más" onClick={() => updateLineQty(sheetLine.key, 1)}
                  className="w-11 h-11 rounded-full border border-brand-muted flex items-center justify-center text-brand-dark/70">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {extraOptionsFor(sheetLine).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-brand-dark/60 mb-1.5">
                  Extras{sheetLine.quantity > 1 ? ` · para las ${sheetLine.quantity} unidades` : ""}
                </p>
                <div className="space-y-1.5">
                  {extraOptionsFor(sheetLine).map((e) => {
                    const selected = sheetLine.extras.some((x) => x.name === e.name);
                    return (
                      <button key={e.name} type="button" role="checkbox" aria-checked={selected}
                        onClick={() => toggleLineExtra(sheetLine.key, e)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-sm transition-colors ${
                          selected ? "border-brand-pink bg-brand-pink/10" : "border-brand-muted"
                        }`}>
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selected ? "bg-brand-pink border-brand-pink text-white" : "border-brand-dark/20"}`}>
                          {selected && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="flex-1 text-brand-dark">{e.name}</span>
                        <span className="font-semibold text-brand-dark/60">{e.price > 0 ? `+${fmt(e.price)}` : "Sin costo"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="linea-nota" className="block text-xs font-semibold text-brand-dark/60 mb-1.5">Nota para cocina</label>
              <textarea
                id="linea-nota"
                rows={2}
                maxLength={200}
                value={sheetLine.note}
                onChange={(e) => updateLineNote(sheetLine.key, e.target.value)}
                placeholder="Ej: sin cebolla, término medio"
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
              />
            </div>

            <p className="flex items-center justify-between text-sm">
              <span className="text-brand-dark/60">Total de la línea</span>
              <span className="font-bold text-brand-pink">{fmt(lineTotal(sheetLine))}</span>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="destructive" onClick={() => removeLine(sheetLine.key)}>Quitar</Button>
              <Button type="button" variant="secondary" onClick={() => duplicateLine(sheetLine.key)}>
                <CopyPlus className="w-4 h-4" /> Otra línea
              </Button>
              <Button type="button" className="col-span-2" onClick={() => setSheetKey(null)}>Listo</Button>
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
