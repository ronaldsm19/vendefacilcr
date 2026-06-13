"use client";

import {
  useState, useEffect, useRef, useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DndContext, useDraggable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus, Trash2, X, Eye, Settings2, Loader2, CalendarCheck, Users,
  ArrowRight, ArrowDown,
} from "lucide-react";
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
  shape: "round" | "square" | "rectangle" | "barstool";
  x: number;
  y: number;
  seats: number;
  label: string;
  status: "libre" | "ocupada" | "reservada";
  statusNote: string;
}

interface SalonWall {
  _id: string;
  areaId: string;
  x: number;
  y: number;
  length: number;
  orientation: "horizontal" | "vertical";
  wallType: "wall" | "counter";
}

type AddMode = "mesa" | "banqueta" | "pared";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  libre:    { bg: "#22c55e", border: "#16a34a", label: "Libre" },
  ocupada:  { bg: "#ef4444", border: "#dc2626", label: "Ocupada" },
  reservada:{ bg: "#f59e0b", border: "#d97706", label: "Reservada" },
};

// ── Table Visual ──────────────────────────────────────────────────────────────

function SeatDot({ x, y }: { x: number; y: number }) {
  return (
    <div style={{
      position: "absolute",
      left: x - 5, top: y - 5,
      width: 10, height: 10,
      borderRadius: "50%",
      background: "#94a3b8",
      border: "1.5px solid #64748b",
    }} />
  );
}

// Seats evenly spaced on a circle — for round tables
function roundSeatPositions(seats: number, W: number, H: number, r: number) {
  const cx = W / 2, cy = H / 2;
  return Array.from({ length: seats }).map((_, i) => {
    const a = (2 * Math.PI / seats) * i - Math.PI / 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

// Seats distributed evenly along the perimeter — for square / rectangle tables.
// Longer sides naturally get more seats (e.g. 12 on a rectangle → 4 top, 4 bottom, 2 each side).
function rectSeatPositions(seats: number, W: number, H: number, inset: number, out: number) {
  const x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
  const bw = x1 - x0, bh = y1 - y0;
  const P = 2 * (bw + bh);
  const gap = P / seats;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < seats; i++) {
    let d = (gap / 2 + i * gap) % P;
    let x: number, y: number;
    if (d < bw) {                       // top edge: left → right
      x = x0 + d; y = y0 - out;
    } else if (d < bw + bh) {           // right edge: top → bottom
      d -= bw; x = x1 + out; y = y0 + d;
    } else if (d < 2 * bw + bh) {       // bottom edge: right → left
      d -= bw + bh; x = x1 - d; y = y1 + out;
    } else {                            // left edge: bottom → top
      d -= 2 * bw + bh; x = x0 - out; y = y1 - d;
    }
    pts.push({ x, y });
  }
  return pts;
}

function TableVisual({ table, selected }: { table: SalonTable; selected?: boolean }) {
  const { bg, border } = STATUS_COLORS[table.status];

  if (table.shape === "barstool") {
    return (
      <div style={{ position: "relative", width: 46, height: 46, userSelect: "none" }}>
        <div style={{
          position: "absolute", inset: 5,
          background: bg, border: `2px solid ${border}`,
          borderRadius: "50%",
          boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${border}` : "0 2px 4px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: "white", fontSize: 11, fontWeight: 700, textShadow: "0 1px 1px rgba(0,0,0,0.3)" }}>
            {table.label || "•"}
          </span>
        </div>
      </div>
    );
  }

  const isRect = table.shape === "rectangle";
  const W = isRect ? 108 : 80;
  const H = 80;
  const bodyInset = 13;
  const seatCount = Math.max(1, Math.min(table.seats, 14));

  const seatPositions = table.shape === "round"
    ? roundSeatPositions(seatCount, W, H, (Math.min(W, H) - 2 * bodyInset) / 2 + 8)
    : rectSeatPositions(seatCount, W, H, bodyInset, 7);

  return (
    <div style={{ position: "relative", width: W, height: H, userSelect: "none" }}>
      {seatPositions.map((p, i) => <SeatDot key={i} x={p.x} y={p.y} />)}
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

// ── Wall Visual ───────────────────────────────────────────────────────────────

function WallVisual({ wall, selected }: { wall: SalonWall; selected?: boolean }) {
  const isCounter = wall.wallType === "counter";
  const bg      = isCounter ? "#92400e" : "#1e293b";
  const outline = isCounter ? "#78350f" : "#0f172a";

  return (
    <div style={{
      width: "100%", height: "100%",
      background: bg,
      border: `1px solid ${outline}`,
      borderRadius: isCounter ? "6px" : "4px",
      boxShadow: selected
        ? `0 0 0 2px white, 0 0 0 3px ${bg}`
        : "0 2px 4px rgba(0,0,0,0.35)",
    }} />
  );
}

// ── Draggable Table ───────────────────────────────────────────────────────────

function DraggableTable({ table, isDesignMode, isSelected, onClick }: {
  table: SalonTable;
  isDesignMode: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `t-${table._id}`,
    disabled: !isDesignMode,
  });
  const dragOffset = transform ? ` translate(${transform.x}px, ${transform.y}px)` : "";
  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: `${table.x}%`, top: `${table.y}%`,
        transform: `translate(-50%, -50%)${dragOffset}`,
        zIndex: isDragging ? 50 : isSelected ? 10 : 3,
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

// ── Draggable Wall ────────────────────────────────────────────────────────────

function DraggableWall({ wall, isDesignMode, isSelected, onClick, onResizeLive, onResizeCommit, canvasRef }: {
  wall: SalonWall;
  isDesignMode: boolean;
  isSelected: boolean;
  onClick: () => void;
  onResizeLive: (id: string, vals: { x: number; y: number; length: number }) => void;
  onResizeCommit: (id: string, vals: { x: number; y: number; length: number }) => void;
  canvasRef: { current: HTMLDivElement | null };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `w-${wall._id}`,
    disabled: !isDesignMode,
  });
  const dragOffset = transform ? ` translate(${transform.x}px, ${transform.y}px)` : "";
  const isH       = wall.orientation === "horizontal";
  const isCounter = wall.wallType === "counter";
  const thickness = isCounter ? 28 : 10;

  const resize = useRef<{
    sign: number; pointerStart: number; startLength: number;
    startX: number; startY: number; canvasSize: number;
    last: { x: number; y: number; length: number };
  } | null>(null);

  function startResize(e: ReactPointerEvent<HTMLDivElement>, sign: number) {
    e.stopPropagation();
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    resize.current = {
      sign,
      pointerStart: isH ? e.clientX : e.clientY,
      startLength: wall.length, startX: wall.x, startY: wall.y,
      canvasSize: isH ? r.width : r.height,
      last: { x: wall.x, y: wall.y, length: wall.length },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveResize(e: ReactPointerEvent<HTMLDivElement>) {
    const s = resize.current;
    if (!s) return;
    const pos     = isH ? e.clientX : e.clientY;
    const dPct    = ((pos - s.pointerStart) / s.canvasSize) * 100;
    const len     = Math.max(5, Math.min(95, s.startLength + s.sign * dPct));
    const applied = len - s.startLength;
    const shift   = (s.sign * applied) / 2;
    const vals = {
      length: len,
      x: isH ? Math.max(0, Math.min(100, s.startX + shift)) : s.startX,
      y: isH ? s.startY : Math.max(0, Math.min(100, s.startY + shift)),
    };
    s.last = vals;
    onResizeLive(wall._id, vals);
  }
  function endResize(e: ReactPointerEvent<HTMLDivElement>) {
    const s = resize.current;
    if (!s) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    resize.current = null;
    onResizeCommit(wall._id, { ...s.last, length: Math.round(s.last.length) });
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: `${wall.x}%`, top: `${wall.y}%`,
        width:  isH ? `${wall.length}%` : `${thickness}px`,
        height: isH ? `${thickness}px` : `${wall.length}%`,
        transform: `translate(-50%, -50%)${dragOffset}`,
        zIndex: isDragging ? 50 : isSelected ? 12 : 2,
        cursor: isDesignMode ? (isDragging ? "grabbing" : "grab") : "default",
        touchAction: "none",
      }}
      {...(isDesignMode ? { ...listeners, ...attributes } : {})}
      onClick={(e) => { e.stopPropagation(); if (isDesignMode) onClick(); }}
    >
      <WallVisual wall={wall} selected={isSelected} />

      {isDesignMode && isSelected && [-1, 1].map(sign => (
        <div key={sign}
          onPointerDown={(e) => startResize(e, sign)}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            width: 15, height: 15, borderRadius: 4,
            background: "white", border: "2px solid #ec4899",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            cursor: isH ? "ew-resize" : "ns-resize",
            touchAction: "none",
            zIndex: 60,
            ...(isH
              ? { top: "50%", transform: "translateY(-50%)", ...(sign === 1 ? { right: -8 } : { left: -8 }) }
              : { left: "50%", transform: "translateX(-50%)", ...(sign === 1 ? { bottom: -8 } : { top: -8 }) }),
          }}
        />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalonPage() {
  const [mode, setMode]     = useState<"design" | "operation">("operation");
  const [areas, setAreas]   = useState<Area[]>([]);
  const [tables, setTables] = useState<SalonTable[]>([]);
  const [walls, setWalls]   = useState<SalonWall[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Design state
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [addMode, setAddMode]               = useState<AddMode>("mesa");
  const [editForm, setEditForm] = useState<{
    shape: SalonTable["shape"]; seats: number; label: string;
  }>({ shape: "round", seats: 4, label: "" });
  const [wallForm, setWallForm] = useState<{
    orientation: "horizontal" | "vertical"; length: number; wallType: "wall" | "counter";
  }>({ orientation: "horizontal", length: 25, wallType: "wall" });
  const [saving, setSaving]           = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaColor, setNewAreaColor] = useState("#6366f1");
  const [addingArea, setAddingArea]   = useState(false);

  // Operation state
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
    const [areasRes, tablesRes, wallsRes] = await Promise.all([
      fetch("/api/admin/salon/areas").then(r => r.json()),
      fetch("/api/admin/salon/tables").then(r => r.json()),
      fetch("/api/admin/salon/walls").then(r => r.json()),
    ]);
    const loaded: Area[] = areasRes.areas ?? [];
    setAreas(loaded);
    setTables(tablesRes.tables ?? []);
    setWalls(wallsRes.walls ?? []);
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

    if (id.startsWith("t-")) {
      const tableId = id.slice(2);
      setTables(prev => prev.map(t => {
        if (String(t._id) !== tableId) return t;
        const nx = Math.max(3, Math.min(97, t.x + dxPct));
        const ny = Math.max(3, Math.min(97, t.y + dyPct));
        fetch(`/api/admin/salon/tables/${t._id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: nx, y: ny }),
        }).catch(() => {});
        return { ...t, x: nx, y: ny };
      }));
    } else if (id.startsWith("w-")) {
      const wallId = id.slice(2);
      setWalls(prev => prev.map(w => {
        if (String(w._id) !== wallId) return w;
        const nx = Math.max(0, Math.min(100, w.x + dxPct));
        const ny = Math.max(0, Math.min(100, w.y + dyPct));
        fetch(`/api/admin/salon/walls/${w._id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: nx, y: ny }),
        }).catch(() => {});
        return { ...w, x: nx, y: ny };
      }));
    }
  }

  // ── Table CRUD ────────────────────────────────────────────────────────────

  async function addTable() {
    if (!activeAreaId) return;
    const isBarstool = addMode === "banqueta";
    const shape      = isBarstool ? "barstool" : editForm.shape;
    const stoolCount = tables.filter(t => t.areaId === activeAreaId && t.shape === "barstool").length;
    const tableCount = tables.filter(t => t.areaId === activeAreaId && t.shape !== "barstool").length;
    const n = tables.filter(t => t.areaId === activeAreaId).length;
    const x = 28 + (n % 6) * 9;
    const y = 26 + (Math.floor(n / 6) % 5) * 12;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/salon/tables", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaId: activeAreaId,
          shape, x, y,
          seats: isBarstool ? 1 : editForm.seats,
          label: editForm.label || (isBarstool ? String(stoolCount + 1) : String(tableCount + 1)),
        }),
      });
      const data = await res.json();
      if (data.table) {
        setTables(prev => [...prev, data.table]);
        setSelectedId(data.table._id);
        setSelectedWallId(null);
        setEditForm({ shape: data.table.shape, seats: data.table.seats, label: data.table.label });
      } else {
        alert(data.error || "No se pudo crear el elemento.");
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
    if (data.ok) { setTables(prev => prev.filter(t => t._id !== id)); setSelectedId(null); }
    else alert(data.error ?? "No se puede eliminar");
  }

  function selectTable(t: SalonTable) {
    setSelectedId(t._id);
    setSelectedWallId(null);
    setEditForm({ shape: t.shape, seats: t.seats, label: t.label });
  }

  // ── Wall CRUD ─────────────────────────────────────────────────────────────

  async function addWall() {
    if (!activeAreaId) return;
    const n = walls.filter(w => w.areaId === activeAreaId).length;
    const x = 30 + (n % 5) * 10;
    const y = 30 + (Math.floor(n / 5) % 4) * 13;
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/salon/walls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId: activeAreaId, ...wallForm, x, y }),
      });
      const data = await res.json();
      if (data.wall) {
        setWalls(prev => [...prev, data.wall]);
        setSelectedWallId(data.wall._id);
        setSelectedId(null);
      } else {
        alert(data.error || "No se pudo crear la pared.");
      }
    } finally { setSaving(false); }
  }

  async function saveWallEdit() {
    if (!selectedWallId) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/salon/walls/${selectedWallId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wallForm),
      });
      const data = await res.json();
      if (data.wall) setWalls(prev => prev.map(w => w._id === selectedWallId ? data.wall : w));
    } finally { setSaving(false); }
  }

  async function deleteWall(id: string) {
    await fetch(`/api/admin/salon/walls/${id}`, { method: "DELETE" });
    setWalls(prev => prev.filter(w => w._id !== id));
    setSelectedWallId(null);
  }

  function selectWall(w: SalonWall) {
    setSelectedWallId(w._id);
    setSelectedId(null);
    setWallForm({ orientation: w.orientation, length: w.length, wallType: w.wallType });
  }

  function resizeWallLive(id: string, vals: { x: number; y: number; length: number }) {
    setWalls(prev => prev.map(w => w._id === id ? { ...w, ...vals } : w));
  }

  function resizeWallCommit(id: string, vals: { x: number; y: number; length: number }) {
    setWalls(prev => prev.map(w => w._id === id ? { ...w, ...vals } : w));
    setWallForm(f => ({ ...f, length: vals.length }));
    fetch(`/api/admin/salon/walls/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vals),
    }).catch(() => {});
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
    if (!confirm("¿Eliminar esta zona y todo su contenido?")) return;
    const res  = await fetch(`/api/admin/salon/areas/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      const next = areas.filter(a => a._id !== id);
      setAreas(next);
      setTables(prev => prev.filter(t => t.areaId !== id));
      setWalls(prev => prev.filter(w => w.areaId !== id));
      setActiveAreaId(prev => prev === id ? (next[0]?._id ?? null) : prev);
    } else alert(data.error ?? "No se puede eliminar");
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

  const selectedTable  = tables.find(t => t._id === selectedId)        ?? null;
  const selectedWall   = walls.find(w => w._id === selectedWallId)     ?? null;
  const visibleTables  = tables.filter(t => t.areaId === activeAreaId);
  const visibleWalls   = walls.filter(w => w.areaId === activeAreaId);
  const hasSelection   = !!selectedTable || !!selectedWall;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-brand-muted bg-white">
        <h1 className="font-brand text-xl font-bold text-brand-dark">Salón</h1>
        <p className="text-brand-dark/40 text-sm hidden sm:block">
          {visibleTables.filter(t => t.shape !== "barstool").length} mesas
          {visibleTables.filter(t => t.shape === "barstool").length > 0 && ` · ${visibleTables.filter(t => t.shape === "barstool").length} banquetas`}
          {visibleWalls.filter(w => w.wallType === "counter").length > 0 && ` · ${visibleWalls.filter(w => w.wallType === "counter").length} mostradores`}
        </p>
        <div className="ml-auto flex items-center gap-1 p-0.5 rounded-xl bg-gray-100">
          <button onClick={() => { setMode("operation"); setSelectedId(null); setSelectedWallId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === "operation" ? "bg-white shadow text-brand-dark" : "text-brand-dark/50"
            }`}>
            <Eye className="w-4 h-4" /> Operación
          </button>
          <button onClick={() => setMode("design")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === "design" ? "bg-white shadow text-brand-dark" : "text-brand-dark/50"
            }`}>
            <Settings2 className="w-4 h-4" /> Diseño
          </button>
        </div>
      </div>

      {/* Area tabs */}
      <div className="shrink-0 flex items-center border-b border-brand-muted bg-white overflow-x-auto px-2">
        {areas.map(area => (
          <button key={area._id}
            onClick={() => { setActiveAreaId(area._id); setSelectedId(null); setSelectedWallId(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeAreaId === area._id
                ? "border-brand-pink text-brand-pink"
                : "border-transparent text-brand-dark/50 hover:text-brand-dark"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: area.color }} />
            {area.name}
            {mode === "design" && (
              <span onClick={(e) => { e.stopPropagation(); removeArea(area._id); }}
                className="ml-0.5 text-brand-dark/30 hover:text-red-400 transition-colors cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        ))}
        {mode === "design" && (
          <button onClick={() => setShowAddArea(true)}
            className="flex items-center gap-1 px-3 py-2.5 text-sm text-brand-dark/40 hover:text-brand-pink transition-colors whitespace-nowrap shrink-0">
            <Plus className="w-3.5 h-3.5" /> Zona
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          {areas.length === 0 ? (
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
                onClick={() => { if (mode === "design") { setSelectedId(null); setSelectedWallId(null); } }}
              >
                {/* Status legend */}
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

                {/* Walls (rendered below tables) */}
                {visibleWalls.map(w => (
                  <DraggableWall key={w._id} wall={w}
                    isDesignMode={mode === "design"}
                    isSelected={selectedWallId === w._id}
                    onClick={() => selectWall(w)}
                    onResizeLive={resizeWallLive}
                    onResizeCommit={resizeWallCommit}
                    canvasRef={canvasRef}
                  />
                ))}

                {/* Tables */}
                {visibleTables.map(t => (
                  <DraggableTable key={t._id} table={t}
                    isDesignMode={mode === "design"}
                    isSelected={selectedId === t._id}
                    onClick={() => mode === "design"
                      ? selectTable(t)
                      : (setActionTable(t), setShowReserve(false))
                    }
                  />
                ))}

                {/* Empty hint */}
                {visibleTables.length === 0 && visibleWalls.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-dark/25 pointer-events-none">
                    <span className="text-4xl">🪑</span>
                    <p className="text-sm">{mode === "design" ? "Agrega elementos desde el panel →" : "Sin mesas en esta zona"}</p>
                  </div>
                )}
              </div>
            </DndContext>
          )}
        </div>

        {/* Design panel */}
        {mode === "design" && (
          <div className="w-[272px] shrink-0 border-l border-brand-muted bg-gray-50 flex flex-col overflow-y-auto">
            <div className="p-4 space-y-4">

              {/* ── Editing selected TABLE ── */}
              {selectedTable && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-brand-dark text-sm">
                      {selectedTable.shape === "barstool" ? "Editar banqueta" : "Editar mesa"}
                    </h3>
                    <button onClick={() => setSelectedId(null)} className="text-brand-dark/30 hover:text-brand-dark transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">Etiqueta</label>
                    <input type="text" value={editForm.label}
                      onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="Número o nombre"
                      className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                    />
                  </div>

                  {selectedTable.shape !== "barstool" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Forma</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["round", "square", "rectangle"] as const).map(s => (
                            <button key={s} onClick={() => setEditForm(f => ({ ...f, shape: s }))}
                              className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                                editForm.shape === s ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                              }`}>
                              {s === "round" ? "Redonda" : s === "square" ? "Cuadrada" : "Rect."}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1">
                          Sillas: <span className="font-bold text-brand-dark">{editForm.seats}</span>
                        </label>
                        <input type="range" min={1} max={12} value={editForm.seats}
                          onChange={e => setEditForm(f => ({ ...f, seats: Number(e.target.value) }))}
                          className="w-full accent-brand-pink" />
                        <div className="flex justify-between text-[10px] text-brand-dark/30 mt-0.5">
                          <span>1</span><span>12</span>
                        </div>
                      </div>
                    </>
                  )}

                  <Button className="w-full" disabled={saving} onClick={saveTableEdit}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Guardar
                  </Button>
                  <Button variant="secondary" className="w-full hover:text-red-500 transition-colors"
                    onClick={() => deleteTable(selectedId!)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                  </Button>
                </>
              )}

              {/* ── Editing selected WALL ── */}
              {selectedWall && !selectedTable && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-brand-dark text-sm">
                      {selectedWall.wallType === "counter" ? "Editar mostrador" : "Editar pared"}
                    </h3>
                    <button onClick={() => setSelectedWallId(null)} className="text-brand-dark/30 hover:text-brand-dark transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Tipo</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["wall", "counter"] as const).map(t => (
                        <button key={t} onClick={() => setWallForm(f => ({ ...f, wallType: t }))}
                          className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                            wallForm.wallType === t ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                          }`}>
                          {t === "wall" ? "🧱 Pared" : "🪵 Mostrador"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Orientación</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["horizontal", "vertical"] as const).map(o => (
                        <button key={o} onClick={() => setWallForm(f => ({ ...f, orientation: o }))}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                            wallForm.orientation === o ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                          }`}>
                          {o === "horizontal" ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                          {o === "horizontal" ? "Horizontal" : "Vertical"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1">
                      Largo: <span className="font-bold text-brand-dark">{Math.round(wallForm.length)}%</span>
                    </label>
                    <input type="range" min={5} max={95} value={wallForm.length}
                      onChange={e => setWallForm(f => ({ ...f, length: Number(e.target.value) }))}
                      className="w-full accent-brand-pink" />
                    <div className="flex justify-between text-[10px] text-brand-dark/30 mt-0.5">
                      <span>Corta</span><span>Larga</span>
                    </div>
                  </div>

                  <p className="text-xs text-brand-dark/50 leading-relaxed bg-pink-50 border border-pink-200 rounded-xl px-3 py-2">
                    💡 También puedes arrastrar los <span className="font-semibold text-brand-pink">puntos rosados</span> en los extremos sobre el plano para estirar el largo directamente.
                  </p>

                  <Button className="w-full" disabled={saving} onClick={saveWallEdit}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Guardar
                  </Button>
                  <Button variant="secondary" className="w-full hover:text-red-500 transition-colors"
                    onClick={() => deleteWall(selectedWallId!)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                  </Button>
                </>
              )}

              {/* ── Add new element ── */}
              {!hasSelection && (
                <>
                  {/* Type selector */}
                  <div>
                    <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Tipo de elemento</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { k: "mesa",     label: "Mesa",     emoji: "🪑" },
                        { k: "banqueta", label: "Banqueta", emoji: "🍺" },
                        { k: "pared",    label: "Pared",    emoji: "🧱" },
                      ] as { k: AddMode; label: string; emoji: string }[]).map(({ k, label, emoji }) => (
                        <button key={k} onClick={() => setAddMode(k)}
                          className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                            addMode === k ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                          }`}>
                          <span className="block text-base leading-none mb-0.5">{emoji}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MESA */}
                  {addMode === "mesa" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Forma</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["round", "square", "rectangle"] as const).map(s => (
                            <button key={s} onClick={() => setEditForm(f => ({ ...f, shape: s }))}
                              className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                                editForm.shape === s ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                              }`}>
                              {s === "round" ? "Redonda" : s === "square" ? "Cuadrada" : "Rect."}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1">Etiqueta (opcional)</label>
                        <input type="text" value={editForm.label}
                          onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                          placeholder={`${visibleTables.filter(t => t.shape !== "barstool").length + 1}`}
                          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1">
                          Sillas: <span className="font-bold text-brand-dark">{editForm.seats}</span>
                        </label>
                        <input type="range" min={1} max={12} value={editForm.seats}
                          onChange={e => setEditForm(f => ({ ...f, seats: Number(e.target.value) }))}
                          className="w-full accent-brand-pink" />
                        <div className="flex justify-between text-[10px] text-brand-dark/30 mt-0.5"><span>1</span><span>12</span></div>
                      </div>
                      <Button className="w-full" disabled={saving || !activeAreaId} onClick={addTable}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                        Agregar mesa
                      </Button>
                    </>
                  )}

                  {/* BANQUETA */}
                  {addMode === "banqueta" && (
                    <>
                      <p className="text-xs text-brand-dark/50 leading-relaxed bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        Las banquetas son asientos individuales para barras y mostradores. Cada una tiene su propio estado de ocupación.
                      </p>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1">Etiqueta (número o inicial)</label>
                        <input type="text" value={editForm.label}
                          onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                          placeholder={`${visibleTables.filter(t => t.shape === "barstool").length + 1}`}
                          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                        />
                      </div>
                      <Button className="w-full" disabled={saving || !activeAreaId} onClick={addTable}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                        Agregar banqueta
                      </Button>
                      <p className="text-xs text-brand-dark/35 text-center leading-tight">
                        Aparece al centro — arrastrala junto al mostrador
                      </p>
                    </>
                  )}

                  {/* PARED / MOSTRADOR */}
                  {addMode === "pared" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Tipo</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["wall", "counter"] as const).map(t => (
                            <button key={t} onClick={() => setWallForm(f => ({ ...f, wallType: t }))}
                              className={`py-2.5 rounded-lg text-xs font-medium border-2 transition-all ${
                                wallForm.wallType === t ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                              }`}>
                              <span className="block text-base leading-none mb-0.5">{t === "wall" ? "🧱" : "🪵"}</span>
                              {t === "wall" ? "Pared" : "Mostrador/Barra"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1.5">Orientación</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["horizontal", "vertical"] as const).map(o => (
                            <button key={o} onClick={() => setWallForm(f => ({ ...f, orientation: o }))}
                              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                                wallForm.orientation === o ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/50"
                              }`}>
                              {o === "horizontal" ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                              {o === "horizontal" ? "Horizontal" : "Vertical"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-dark/60 mb-1">
                          Largo: <span className="font-bold text-brand-dark">{wallForm.length}%</span>
                          <span className="text-brand-dark/30 font-normal ml-1">del canvas</span>
                        </label>
                        <input type="range" min={5} max={95} value={wallForm.length}
                          onChange={e => setWallForm(f => ({ ...f, length: Number(e.target.value) }))}
                          className="w-full accent-brand-pink" />
                        <div className="flex justify-between text-[10px] text-brand-dark/30 mt-0.5">
                          <span>Corta (5%)</span><span>Larga (95%)</span>
                        </div>
                      </div>
                      <Button className="w-full" disabled={saving || !activeAreaId} onClick={addWall}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                        Agregar {wallForm.wallType === "wall" ? "pared" : "mostrador"}
                      </Button>
                      <p className="text-xs text-brand-dark/35 text-center leading-tight">
                        Aparece al centro — arrastrala y ajusta el largo
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
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Area Dialog */}
      <Dialog open={showAddArea} onOpenChange={(v) => { if (!v) { setShowAddArea(false); setNewAreaName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva zona</DialogTitle></DialogHeader>
          <div className="space-y-4 px-6 pb-6 pt-2">
            <input type="text" value={newAreaName} onChange={e => setNewAreaName(e.target.value)}
              placeholder="Ej: Terraza, Salón, Barra, Balcón..."
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              onKeyDown={e => e.key === "Enter" && addArea()} autoFocus
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-brand-dark/60 shrink-0">Color:</label>
              <input type="color" value={newAreaColor} onChange={e => setNewAreaColor(e.target.value)}
                className="w-9 h-8 rounded-lg cursor-pointer border border-brand-muted p-0.5" />
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

      {/* Table Action Modal */}
      <Dialog open={!!actionTable} onOpenChange={(v) => { if (!v) { setActionTable(null); setShowReserve(false); } }}>
        <DialogContent className="max-w-sm">
          {actionTable && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {actionTable.shape === "barstool" ? "Banqueta" : "Mesa"} {actionTable.label}
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: STATUS_COLORS[actionTable.status].bg }}>
                    {STATUS_COLORS[actionTable.status].label}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6 space-y-4">
                <div className="flex items-center gap-3 text-sm text-brand-dark/60">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>
                    {actionTable.shape === "barstool"
                      ? "Banqueta individual"
                      : `${actionTable.seats} ${actionTable.seats === 1 ? "silla" : "sillas"}`}
                  </span>
                  {actionTable.statusNote && (
                    <span className="font-medium text-brand-dark">· {actionTable.statusNote}</span>
                  )}
                </div>

                {!showReserve ? (
                  <div className="space-y-2">
                    {actionTable.status === "libre" && (
                      <>
                        <Button className="w-full" disabled={statusSaving} onClick={() => changeStatus("ocupada")}>
                          {statusSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "☕ "}
                          Marcar como ocupada
                        </Button>
                        {actionTable.shape !== "barstool" && (
                          <Button variant="secondary" className="w-full" onClick={() => setShowReserve(true)}>
                            <CalendarCheck className="w-4 h-4 mr-2" /> Reservar
                          </Button>
                        )}
                      </>
                    )}
                    {actionTable.status === "ocupada" && (
                      <Button className="w-full" style={{ background: "#22c55e", color: "white" }}
                        disabled={statusSaving} onClick={() => changeStatus("libre", "")}>
                        {statusSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "✓ "}
                        Liberar
                      </Button>
                    )}
                    {actionTable.status === "reservada" && (
                      <>
                        <Button className="w-full" disabled={statusSaving}
                          onClick={() => changeStatus("ocupada", actionTable.statusNote)}>
                          {statusSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "☕ "}
                          Cliente llegó — Marcar ocupada
                        </Button>
                        <Button variant="secondary" className="w-full hover:text-red-500 transition-colors"
                          disabled={statusSaving} onClick={handleCancelReservation}>
                          Cancelar reserva
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
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
                      <Button variant="secondary" className="flex-1" onClick={() => setShowReserve(false)}>← Atrás</Button>
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
