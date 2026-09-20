"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, Search, Plus, Minus, StickyNote, Loader2, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "@/components/admin/SessionContext";
import { usePolling } from "@/hooks/usePolling";
import { TABLE_STATUS_META, type TableStatus } from "@/lib/tableStatus";
import { DEFAULT_COMANDA_CONFIG, type ComandaConfigData } from "@/lib/comandaConfig";
import { STATION_LABELS, type ProductStation } from "@/lib/station";
import ComandaCard, { type ComandaRow } from "@/components/admin/ComandaCard";
import CancelComandaDialog from "@/components/admin/CancelComandaDialog";
import ServeAllDialog from "@/components/admin/ServeAllDialog";

interface CatalogProduct {
  _id: string;
  name: string;
  price: number;
  category: string;
  station: ProductStation;
  image?: string;
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

  const load = useCallback(async () => {
    if (!isPremium) { setLoading(false); return; }
    setLoading(true);
    const [liveRes, catalogRes, nextRes, openRes] = await Promise.all([
      fetch("/api/admin/salon/live").then((r) => r.json()),
      fetch("/api/admin/comandas/catalog").then((r) => r.json()),
      fetch("/api/admin/comandas/next-number").then((r) => r.json()),
      fetch(`/api/admin/comandas?tableId=${tableId}&open=1&limit=50`).then((r) => r.json()),
    ]);
    const foundTable = (liveRes.tables ?? []).find((t: LiveTable) => t._id === tableId) ?? null;
    setTable(foundTable);
    const area = (liveRes.areas ?? []).find((a: { _id: string; name: string }) => a._id === foundTable?.areaId);
    setAreaName(area?.name ?? "");
    setComandaConfig(liveRes.comandaConfig ?? DEFAULT_COMANDA_CONFIG);
    setCatalog(catalogRes.products ?? []);
    setNextNumber(nextRes.nextNumber ?? 1);
    const open = openRes.comandas ?? [];
    setOpenComandas(open);
    if (!editId && open.length > 0) setTab("open");
    setLoading(false);
  }, [tableId, isPremium, editId]);

  useEffect(() => { load(); }, [load]);

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
        })));
        setTab("new");
      })
      .finally(() => setEditLoading(false));
  }, [editId, isPremium]);

  function incrementCatalog(p: CatalogProduct) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p._id);
      if (idx === -1) {
        return [...prev, { key: crypto.randomUUID(), productId: p._id, productName: p.name, unitPrice: p.price, station: p.station, quantity: 1, note: "" }];
      }
      return prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l));
    });
  }
  function decrementCatalog(p: CatalogProduct) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p._id);
      if (idx === -1) return prev;
      const line = prev[idx];
      if (line.quantity <= 1) return prev.filter((_, i) => i !== idx);
      return prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity - 1 } : l));
    });
  }
  function quantityFor(productId: string): number {
    return lines.find((l) => l.productId === productId)?.quantity ?? 0;
  }
  function updateLineQty(key: string, delta: number) {
    setLines((prev) => prev.flatMap((l) => {
      if (l.key !== key) return [l];
      const q = l.quantity + delta;
      if (q <= 0) return [];
      return [{ ...l, quantity: q }];
    }));
  }
  function updateLineNote(key: string, note: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, note } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }
  function duplicateLine(key: string) {
    setLines((prev) => {
      const src = prev.find((l) => l.key === key);
      if (!src) return prev;
      return [...prev, { ...src, key: crypto.randomUUID(), quantity: 1, note: "" }];
    });
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
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, note: l.note })),
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
      })));
    }
  }

  async function handleServe(id: string) {
    await fetch(`/api/admin/comandas/${id}/serve`, { method: "POST" });
    await refreshOpen();
  }

  const totalItems = lines.reduce((s, l) => s + l.quantity, 0);
  const pendingToServe = openComandas.filter((c) => c.status === "enviada");
  const categories = ["Todas", ...Array.from(new Set(catalog.map((p) => p.category)))];
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
            <div className="p-4 space-y-4 pb-24">
              {table.status === "por_limpiar" && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
                  Esta mesa está marcada por limpiar
                </div>
              )}

              <input
                type="text"
                placeholder="Cliente (opcional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-dark/30" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-brand-muted rounded-xl text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button key={c} onClick={() => setActiveCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border-2 transition-all ${
                      activeCategory === c ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>

              {visibleProducts.length === 0 ? (
                <p className="text-center text-sm text-brand-dark/40 py-6">
                  {catalog.length === 0 ? "No hay productos disponibles. Agregalos en Productos." : "Sin resultados."}
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleProducts.map((p) => {
                    const qty = quantityFor(p._id);
                    return (
                      <div key={p._id} className="bg-white rounded-xl border border-brand-muted p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-brand-dark text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-brand-pink font-semibold">{fmt(p.price)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-muted text-brand-dark/50">
                              {STATION_LABELS[p.station]}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => decrementCatalog(p)} disabled={qty === 0}
                            className="w-8 h-8 rounded-lg border border-brand-muted flex items-center justify-center text-brand-dark/60 disabled:opacity-30">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{qty}</span>
                          <button onClick={() => incrementCatalog(p)}
                            className="w-8 h-8 rounded-lg border border-brand-muted flex items-center justify-center text-brand-dark/60">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* En esta comanda */}
              <div className="pt-2">
                <p className="text-xs font-medium text-brand-dark/40 uppercase tracking-wide mb-2">En esta comanda</p>
                {lines.length === 0 ? (
                  <p className="text-sm text-brand-dark/40">Todavía no agregaste productos.</p>
                ) : (
                  <div className="space-y-3">
                    {lines.map((l) => (
                      <div key={l.key} className="bg-gray-50 rounded-xl border border-brand-muted p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-brand-dark text-sm">{l.productName}</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateLineQty(l.key, -1)} className="w-7 h-7 rounded-lg border border-brand-muted flex items-center justify-center text-brand-dark/60">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center text-sm font-bold">{l.quantity}</span>
                            <button onClick={() => updateLineQty(l.key, 1)} className="w-7 h-7 rounded-lg border border-brand-muted flex items-center justify-center text-brand-dark/60">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StickyNote className="w-3.5 h-3.5 text-brand-dark/30 shrink-0" />
                          <input
                            type="text"
                            placeholder="Nota (opcional)"
                            maxLength={200}
                            value={l.note}
                            onChange={(e) => updateLineNote(l.key, e.target.value)}
                            className="flex-1 border border-brand-muted rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-pink"
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-0.5">
                          <button onClick={() => duplicateLine(l.key)} className="text-xs text-brand-pink font-medium">
                            Agregar otra línea
                          </button>
                          <button onClick={() => removeLine(l.key)} className="text-xs text-red-500 font-medium">
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-dark/60 mb-1">Notas de la comanda</label>
                <textarea
                  maxLength={500}
                  rows={2}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Notas generales (opcional)"
                  className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
                />
              </div>

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
              {editId && (
                <button onClick={exitEdit} className="text-sm text-brand-dark/50 underline">Cancelar edición</button>
              )}
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
        <div className="sticky bottom-0 bg-white border-t border-brand-muted p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-brand-dark/60">{totalItems} ítems</span>
          <Button className="flex-1" disabled={lines.length === 0 || saving} onClick={handleSubmit}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editId ? "Guardar cambios" : "Enviar comanda")}
          </Button>
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
