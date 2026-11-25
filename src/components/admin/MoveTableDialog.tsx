"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyComandasUpdated } from "@/components/admin/PendingComandasContext";

interface LiveArea { _id: string; name: string; color?: string }
interface LiveTable { _id: string; areaId: string; label: string; status: string; seats?: number; shape?: string }

interface MoveTableDialogProps {
  fromTableId: string;
  fromLabel: string;
  /** Si viene, se pasa solo esa comanda; si no, todas las abiertas de la mesa. */
  comandaId?: string;
  comandaNumber?: number;
  onClose: () => void;
  onDone: (toTableId: string, toLabel: string) => void;
}

/**
 * Cambio de mesa: la gente se pasó a otra mesa y la comanda se va con ella. Muestra solo las
 * mesas libres, por zona; un toque elige y otro confirma.
 */
export default function MoveTableDialog({ fromTableId, fromLabel, comandaId, comandaNumber, onClose, onDone }: MoveTableDialogProps) {
  const [areas, setAreas] = useState<LiveArea[]>([]);
  const [tables, setTables] = useState<LiveTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<LiveTable | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/salon/live", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setAreas(d.areas ?? []);
        setTables((d.tables ?? []).filter((t: LiveTable) => t.status === "libre" && t._id !== fromTableId));
      })
      .catch(() => { if (alive) setError("No se pudieron cargar las mesas"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fromTableId]);

  async function handleMove() {
    if (!target || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/comandas/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTableId, toTableId: target._id, ...(comandaId ? { comandaId } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar de mesa");
        return;
      }
      notifyComandasUpdated();
      onDone(target._id, target.label);
    } finally {
      setSaving(false);
    }
  }

  const byArea = areas
    .map((a) => ({ area: a, tables: tables.filter((t) => t.areaId === a._id) }))
    .filter((g) => g.tables.length > 0);
  const sortLabel = (a: LiveTable, b: LiveTable) => a.label.localeCompare(b.label, "es", { numeric: true });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar de mesa</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          <p className="text-sm text-brand-dark/60">
            {comandaId
              ? <>La comanda #{comandaNumber} de la mesa {fromLabel} se pasa a la mesa que elijás.</>
              : <>Todo lo que tiene abierto la mesa {fromLabel} se pasa a la mesa que elijás.</>}
            {" "}Lo ya cobrado no cambia.
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-brand-pink" /></div>
          ) : byArea.length === 0 ? (
            <p className="text-sm text-brand-dark/50 bg-gray-50 rounded-xl px-3 py-3">No hay mesas libres en este momento.</p>
          ) : (
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {byArea.map(({ area, tables: list }) => (
                <div key={area._id} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark/40">{area.name}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[...list].sort(sortLabel).map((t) => {
                      const selected = target?._id === t._id;
                      return (
                        <button
                          key={t._id}
                          type="button"
                          onClick={() => setTarget(t)}
                          aria-pressed={selected}
                          aria-label={`Mesa ${t.label}, ${area.name}`}
                          className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition cursor-pointer ${
                            selected
                              ? "border-brand-pink bg-brand-pink text-white"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {target && (
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-brand-dark bg-brand-muted/40 rounded-xl px-3 py-2">
              Mesa {fromLabel} <ArrowRight className="w-4 h-4" aria-hidden /> Mesa {target.label}
            </p>
          )}
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2" role="alert">{error}</p>}

          <div className="flex gap-3">
            <Button variant="cancel" className="flex-1" onClick={onClose}>Volver</Button>
            <Button className="flex-1" disabled={!target || saving} onClick={handleMove}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cambiar de mesa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
