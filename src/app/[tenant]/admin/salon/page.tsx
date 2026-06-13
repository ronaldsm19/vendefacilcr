"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext, useDraggable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, Trash2, X, Eye, Settings2, Loader2, CalendarCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Area {
  _id: string;
  name: string;
  color: string;
  order: number;
}

interface SalonTable {
  _id: string;
  areaId: string;
  shape: "round" | "square" | "rectangle";
  x: number;
  y: number;
  seats: number;
  label: string;
  status: "libre" | "ocupada" | "reservada";
  statusNote: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  libre:    { bg: "#22c55e", border: "#16a34a", label: "Libre" },
  ocupada:  { bg: "#ef4444", border: "#dc2626", label: "Ocupada" },
  reservada:{ bg: "#f59e0b", border: "#d97706", label: "Reservada" },
};

// ── Table Visual ──────────────────────────────────────────────────────────────

function SeatDot({ cx, cy, angle, r }: { cx: number; cy: number; angle: number; r: number }) {
  const rad = (angle * Math.PI) / 180;
  return (
    <div style={{
      position: "absolute",
      left: cx + Math.cos(rad) * r - 5,
      top:  cy + Math.sin(rad) * r - 5,
      width: 10, height: 10,
      borderRadius: "50%",
      background: "#94a3b8",
      border: "1.5px solid #64748b",
    }} />
  );
}

function TableVisual({ table, selected }: { table: SalonTable; selected?: boolean }) {
  const { bg, border } = STATUS_COLORS[table.status];
  const isRect = table.shape === "rectangle";
  const W = isRect ? 96 : 72;
  const H = 72;
  const cx = W / 2, cy = H / 2;
  const bodyInset = 11;
  const seatCount = Math.min(table.seats, 12);
  const seatR = Math.min(W, H) / 2 - 3;

  return (
    <div style={{ position: "relative", width: W, height: H, userSelect: "none" }}>
      {Array.from({ length: seatCount }).map((_, i) => (
        <SeatDot key={i} cx={cx} cy={cy} angle={(360 / seatCount) * i - 90} r={seatR + 5} />
      ))}
      <div style={{
        position: "absolute", inset: bodyInset,
        background: bg, border: `2px solid ${border}`,
        borderRadius: table.shape === "round" ? "50%" : "8px",
        boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${border}` : "0 2px 6px rgba(0,0,0,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          color: "white", fontSize: 12, fontWeight: 700,
          textAlign: "center", lineHeight: 1.1,
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}>
          {table.label || "?"}
        </span>
      </div>
    </div>
  );
}

// ── Draggable Wrapper ─────────────────────────────────────────────────────────

function DraggableTable({ table, isDesignMode, isSelected, onClick }: {
  table: SalonTable;
  isDesignMode: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table._id,
    disabled: !isDesignMode,
  });

  const dragOffset = transform ? ` translate(${transform.x}px, ${transform.y}px)` : "";

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: `${table.x}%`,
        top: `${table.y}%`,
        transform: `translate(-50%, -50%)${dragOffset}`,
        zIndex: isDragging ? 50 : isSelected ? 10 : 1,
        cursor: isDesignMode ? (isDragging ? "grabbing" : "grab") : "pointer",
        touchAction: "none",
      }}
      {...(isDesignMode ? { ...listeners, ...attributes } : {})}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <TableVisual table={table} selected={isSelected} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalonPage() {
  const [mode, setMode]           = useState<"design" | "operation">("operation");
  const [areas, setAreas]         = useState<Area[]>([]);
  const [tables, setTables]       = useState<SalonTable[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  // Design mode
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [editForm, setEditForm]       = useState<{ shape: SalonTable["shape"]; seats: number; label: string }>({
    shape: "round", seats: 4, label: "",
  });
  const [saving, setSaving]           = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaColor, setNewAreaColor] = useState("#6366f1");
  const [addingArea, setAddingArea]   = useState(false);

  // Operation mode
  const [actionTable, setActionTable]   = useState<SalonTable | null>(null);
  const [showReserve, setShowReserve]   = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [reserveForm, setReserveForm]   = useState({
    customerName: "", partySize: 2, dateTime: "", phone: "", notes: "",
  });
  const [reserveSaving, setReserveSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const sensors   = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const [areasRes, tablesRes] = await Promise.all([
      fetch("/api/admin/salon/areas").then(r => r.json()),
      fetch("/api/admin/salon/tables").then(r => r.json()),
    ]);
    const loaded: Area[] = areasRes.areas ?? [];
    setAreas(loaded);
    setTables(tablesRes.tables ?? []);
    setActiveAreaId(prev => prev ?? loaded[0]?._id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Drag ──────────────────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dxPct = (event.delta.x / width)  * 100;
    const dyPct = (event.delta.y / height) * 100;
    const id    = String(event.active.id);

    setTables(prev => prev.map(t => {
      if (String(t._id) !== id) return t;
      const nx = Math.max(3, Math.min(97, t.x + dxPct));
      const ny = Math.max(3, Math.min(97, t.y + dyPct));
      fetch(`/api/admin/salon/tables/${t._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: nx, y: ny }),
      }).catch(() => {});
      return { ...t, x: nx, y: ny };
    }));
  }

  // ── Table CRUD ────────────────────────────────────────────────────────────

  async function addTable() {
    if (!activeAreaId) return;
    setSaving(true);
    try {
      const count = tables.filter(t => t.areaId === activeAreaId).length;
      const res   = await fetch("/api/admin/salon/tables", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaId: activeAreaId,
          ...editForm,
          label: editForm.label || String(count + 1),
        }),
      });
      const data = await res.json();
      if (data.table) {
        setTables(prev => [...prev, data.table]);
        setSelectedId(data.table._id);
        setEditForm({ shape: data.table.shape, seats: data.table.seats, label: data.table.label });
      }
    } finally { setSaving(false); }
  }

  async function saveTableEdit() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/salon/tables/${selectedId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.table) setTables(prev => prev.map(t => t._id === selectedId ? data.table : t));
    } finally { setSaving(false); }
  }

  async function deleteTable(id: string) {
    const res  = await fetch(`/api/admin/salon/tables/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setTables(prev => prev.filter(t => t._id !== id));
      setSelectedId(null);
    } else {
      alert(data.error ?? "No se puede eliminar");
    }
  }

  function selectTable(t: SalonTable) {
    setSelectedId(t._id);
    setEditForm({ shape: t.shape, seats: t.seats, label: t.label });
  }

  // ── Area CRUD ─────────────────────────────────────────────────────────────

  async function addArea() {
    if (!newAreaName.trim()) return;
    setAddingArea(true);
    try {
      const res  = await fetch("/api/admin/salon/areas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAreaName.trim(), color: newAreaColor }),
      });
      const data = await res.json();
      if (data.area) {
        setAreas(prev => [...prev, data.area]);
        setActiveAreaId(data.area._id);
        setShowAddArea(false);
        setNewAreaName("");
      }
    } finally { setAddingArea(false); }
  }

  async function removeArea(id: string) {
    if (!confirm("¿Eliminar esta zona y todas sus mesas?")) return;
    const res  = await fetch(`/api/admin/salon/areas/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      const next = areas.filter(a => a._id !== id);
      setAreas(next);
      setTables(prev => prev.filter(t => t.areaId !== id));
      setActiveAreaId(prev => prev === id ? (next[0]?._id ?? null) : prev);
    } else {
      alert(data.error ?? "No se puede eliminar");
    }
  }

  // ── Status & Reservation ──────────────────────────────────────────────────

  async function changeStatus(status: SalonTable["status"], note = "") {
    if (!actionTable) return;
    setStatusSaving(true);
    try {
      const res  = await fetch(`/api/admin/salon/tables/${actionTable._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, statusNote: note }),
      });
      const data = await res.json();
      if (data.table) {
        setTables(prev => prev.map(t => t._id === actionTable._id ? data.table : t));
        setActionTable(data.table);
      }
    } finally { setStatusSaving(false); }
  }

  async function handleCancelReservation() {
    if (!actionTable) return;
    setStatusSaving(true);
    try {
      // Cancel active reservations for this table
      const res  = await fetch(`/api/admin/salon/reservations?tableId=${actionTable._id}`);
      const data = await res.json();
      await Promise.all((data.reservations ?? []).map((r: { _id: string }) =>
        fetch(`/api/admin/salon/reservations/${r._id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        })
      ));
      await load();
      setActionTable(null);
    } finally { setStatusSaving(false); }
  }

  async function createReservation() {
    if (!actionTable || !reserveForm.customerName || !reserveForm.dateTime) return;
    setReserveSaving(true);
    try {
      const res = await fetch("/api/admin/salon/reservations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: actionTable._id, ...reserveForm }),
      });
      const data = await res.json();
      if (data.reservation) {
        await load();
        setActionTable(null);
        setShowReserve(false);
        setReserveForm({ customerName: "", partySize: 2, dateTime: "", phone: "", notes: "" });
      }
    } finally { setReserveSaving(false); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedTable   = tables.find(t => t._id === selectedId) ?? null;
  const visibleTables   = tables.filter(t => t.areaId === activeAreaId);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-brand-muted bg-white">
        <h1 className="font-brand text-xl font-bold text-brand-dark">Salón</h1>
        <p className="text-brand-dark/40 text-sm hidden sm:block">
          {tables.length} mesas · {areas.length} zonas
        </p>
        <div className="ml-auto flex items-center gap-1 p-0.5 rounded-xl bg-gray-100">
          <button
            onClick={() => { setMode("operation"); setSelectedId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === "operation" ? "bg-white shadow text-brand-dark" : "text-brand-dark/50"
            }`}
          >
            <Eye className="w-4 h-4" /> Operación
          </button>
          <button
            onClick={() => setMode("design")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === "design" ? "bg-white shadow text-brand-dark" : "text-brand-dark/50"
            }`}
          >
            <Settings2 className="w-4 h-4" /> Diseño
          </button>
        </div>
      </div>

      {/* ── Area tabs ── */}
      <div className="shrink-0 flex items-center border-b border-brand-muted bg-white overflow-x-auto px-2">
        {areas.map(area => (
          <button
            key={area._id}
            onClick={() => { setActiveAreaId(area._id); setSelectedId(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeAreaId === area._id
                ? "border-brand-pink text-brand-pink"
                : "border-transparent text-brand-dark/50 hover:text-brand-dark"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: area.color }} />
            {area.name}
            {mode === "design" && (
              <span
                onClick={(e) => { e.stopPropagation(); removeArea(area._id); }}
                className="ml-0.5 text-brand-dark/30 hover:text-red-400 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        ))}
        {mode === "design" && (
          <button
            onClick={() => setShowAddArea(true)}
            className="flex items-center gap-1 px-3 py-2.5 text-sm text-brand-dark/40 hover:text-brand-pink transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Zona
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Canvas ── */}
        <div className="flex-1 relative overflow-hidden">
          {areas.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-4 text-brand-dark/40">
              <span className="text-5xl">🗺️</span>
              <p className="text-base font-medium">Sin zonas configuradas</p>
              {mode === "design"
                ? <Button onClick={() => setShowAddArea(true)}><Plus className="w-4 h-4 mr-1" />Crear primera zona</Button>
                : <p className="text-sm">Activa Modo Diseño para comenzar</p>
              }
            </div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div
                ref={canvasRef}
                className="w-full h-full relative select-none"
                style={{
                  backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  backgroundColor: "#f9fafb",
                }}
                onClick={() => mode === "design" && setSelectedId(null)}
              >
                {/* Legend */}
                {mode === "operation" && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-white/95 px-3 py-2 rounded-xl border border-gray-200 shadow-sm z-20">
                    {(["libre", "ocupada", "reservada"] as const).map(s => (
                      <div key={s} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS_COLORS[s].bg }} />
                        <span className="text-xs font-medium text-gray-600">{STATUS_COLORS[s].label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tables */}
                {visibleTables.map(t => (
                  <DraggableTable
                    key={t._id}
                    table={t}
                    isDesignMode={mode === "design"}
                    isSelected={selectedId === t._id}
                    onClick={() =>
                      mode === "design" ? selectTable(t) : (setActionTable(t), setShowReserve(false))
                    }
                  />
                ))}

                {/* Empty canvas hint */}
                {visibleTables.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-dark/25 pointer-events-none">
                    <span className="text-4xl">🪑</span>
                    <p className="text-sm">
                      {mode === "design" ? "Agrega mesas desde el panel →" : "Sin mesas en esta zona"}
                    </p>
                  </div>
                )}
              </div>
            </DndContext>
          )}
        </div>

        {/* ── Design side panel ── */}
        {mode === "design" && (
          <div className="w-68 shrink-0 border-l border-brand-muted bg-gray-50 flex flex-col overflow-y-auto" style={{ width: 272 }}>
            <div className="p-4 space-y-4">
              {selectedTable ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-brand-dark text-sm">Editar mesa</h3>
                    <button onClick={() => setSelectedId(null)} className="text-brand-dark/30 hover:text-brand-dark transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Shape */}
                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Forma</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["round", "square", "rectangle"] as const).map(s => (
                        <button key={s}
                          onClick={() => setEditForm(f => ({ ...f, shape: s }))}
                          className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                            editForm.shape === s ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                          }`}
                        >
                          {s === "round" ? "Redonda" : s === "square" ? "Cuadrada" : "Rectangular"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Label */}
                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">Etiqueta</label>
                    <input type="text" value={editForm.label}
                      onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="Número o nombre de mesa"
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                    />
                  </div>

                  {/* Seats */}
                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">
                      Sillas: <span className="font-bold text-brand-dark">{editForm.seats}</span>
                    </label>
                    <input type="range" min={1} max={12} value={editForm.seats}
                      onChange={e => setEditForm(f => ({ ...f, seats: Number(e.target.value) }))}
                      className="w-full accent-brand-pink"
                    />
                    <div className="flex justify-between text-[10px] text-brand-dark/30 mt-0.5">
                      <span>1</span><span>12</span>
                    </div>
                  </div>

                  <Button className="w-full" disabled={saving} onClick={saveTableEdit}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    Guardar cambios
                  </Button>
                  <Button variant="secondary" className="w-full hover:text-red-500 transition-colors"
                    onClick={() => deleteTable(selectedId!)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar mesa
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-brand-dark text-sm">Nueva mesa</h3>

                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Forma</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["round", "square", "rectangle"] as const).map(s => (
                        <button key={s}
                          onClick={() => setEditForm(f => ({ ...f, shape: s }))}
                          className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                            editForm.shape === s ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                          }`}
                        >
                          {s === "round" ? "Redonda" : s === "square" ? "Cuadrada" : "Rectangular"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">Etiqueta (opcional)</label>
                    <input type="text" value={editForm.label}
                      onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                      placeholder={`${visibleTables.length + 1}`}
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">
                      Sillas: <span className="font-bold text-brand-dark">{editForm.seats}</span>
                    </label>
                    <input type="range" min={1} max={12} value={editForm.seats}
                      onChange={e => setEditForm(f => ({ ...f, seats: Number(e.target.value) }))}
                      className="w-full accent-brand-pink"
                    />
                    <div className="flex justify-between text-[10px] text-brand-dark/30 mt-0.5">
                      <span>1</span><span>12</span>
                    </div>
                  </div>

                  <Button className="w-full" disabled={saving || !activeAreaId} onClick={addTable}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                    Agregar mesa
                  </Button>
                  <p className="text-xs text-brand-dark/35 text-center leading-tight">
                    La mesa aparece al centro — arrastrala a su posición
                  </p>
                </>
              )}

              {/* Stats */}
              {visibleTables.length > 0 && (
                <div className="pt-4 border-t border-brand-muted space-y-1.5">
                  <p className="text-xs font-medium text-brand-dark/40 uppercase tracking-wide">Zona actual</p>
                  {(["libre", "ocupada", "reservada"] as const).map(s => {
                    const count = visibleTables.filter(t => t.status === s).length;
                    if (count === 0) return null;
                    return (
                      <div key={s} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[s].bg }} />
                          <span className="text-brand-dark/60">{STATUS_COLORS[s].label}</span>
                        </div>
                        <span className="font-semibold text-brand-dark">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Area Dialog ── */}
      <Dialog open={showAddArea} onOpenChange={(v) => { if (!v) { setShowAddArea(false); setNewAreaName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva zona</DialogTitle></DialogHeader>
          <div className="space-y-4 px-1 py-2">
            <input
              type="text" value={newAreaName}
              onChange={e => setNewAreaName(e.target.value)}
              placeholder="Ej: Terraza, Salón, Barra, Balcón..."
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              onKeyDown={e => e.key === "Enter" && addArea()}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-brand-dark/60 shrink-0">Color de la pestaña:</label>
              <input type="color" value={newAreaColor} onChange={e => setNewAreaColor(e.target.value)}
                className="w-9 h-8 rounded-lg cursor-pointer border border-brand-muted p-0.5"
              />
              {newAreaName && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-brand-dark">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: newAreaColor }} />
                  {newAreaName}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowAddArea(false); setNewAreaName(""); }}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={addingArea || !newAreaName.trim()} onClick={addArea}>
                {addingArea ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear zona"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Table Action Modal (Operation mode) ── */}
      <Dialog open={!!actionTable} onOpenChange={(v) => { if (!v) { setActionTable(null); setShowReserve(false); } }}>
        <DialogContent className="max-w-sm">
          {actionTable && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  Mesa {actionTable.label}
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: STATUS_COLORS[actionTable.status].bg }}>
                    {STATUS_COLORS[actionTable.status].label}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="px-1 pb-2 space-y-4">
                {/* Table info */}
                <div className="flex items-center gap-3 text-sm text-brand-dark/60">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{actionTable.seats} {actionTable.seats === 1 ? "silla" : "sillas"}</span>
                  {actionTable.statusNote && (
                    <span className="font-medium text-brand-dark">· {actionTable.statusNote}</span>
                  )}
                </div>

                {!showReserve ? (
                  <div className="space-y-2">
                    {/* Libre */}
                    {actionTable.status === "libre" && (
                      <>
                        <Button className="w-full" disabled={statusSaving}
                          onClick={() => changeStatus("ocupada")}>
                          {statusSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "☕ "}
                          Marcar como ocupada
                        </Button>
                        <Button variant="secondary" className="w-full" onClick={() => setShowReserve(true)}>
                          <CalendarCheck className="w-4 h-4 mr-2" /> Reservar mesa
                        </Button>
                      </>
                    )}

                    {/* Ocupada */}
                    {actionTable.status === "ocupada" && (
                      <Button className="w-full" style={{ background: "#22c55e", color: "white" }}
                        disabled={statusSaving} onClick={() => changeStatus("libre", "")}>
                        {statusSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "✓ "}
                        Liberar mesa
                      </Button>
                    )}

                    {/* Reservada */}
                    {actionTable.status === "reservada" && (
                      <>
                        <Button className="w-full" disabled={statusSaving}
                          onClick={() => changeStatus("ocupada", actionTable.statusNote)}>
                          {statusSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "☕ "}
                          Cliente llegó — Marcar ocupada
                        </Button>
                        <Button variant="secondary" className="w-full hover:text-red-500 transition-colors"
                          disabled={statusSaving} onClick={handleCancelReservation}>
                          {statusSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Cancelar reserva
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  /* Reservation form */
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-brand-dark">Datos de la reserva</h4>
                    <input type="text" placeholder="Nombre del cliente *"
                      value={reserveForm.customerName}
                      onChange={e => setReserveForm(f => ({ ...f, customerName: e.target.value }))}
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-brand-dark/50 mb-1">Personas</label>
                        <input type="number" min={1} max={30} value={reserveForm.partySize}
                          onChange={e => setReserveForm(f => ({ ...f, partySize: Number(e.target.value) }))}
                          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-brand-dark/50 mb-1">Teléfono</label>
                        <input type="tel" placeholder="Opcional" value={reserveForm.phone}
                          onChange={e => setReserveForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-brand-dark/50 mb-1">Fecha y hora *</label>
                      <input type="datetime-local" value={reserveForm.dateTime}
                        onChange={e => setReserveForm(f => ({ ...f, dateTime: e.target.value }))}
                        className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                        style={{ colorScheme: "light" }}
                      />
                    </div>
                    <textarea placeholder="Notas (opcional)" rows={2} value={reserveForm.notes}
                      onChange={e => setReserveForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button variant="secondary" className="flex-1" onClick={() => setShowReserve(false)}>
                        ← Atrás
                      </Button>
                      <Button className="flex-1"
                        disabled={reserveSaving || !reserveForm.customerName || !reserveForm.dateTime}
                        onClick={createReservation}>
                        {reserveSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
