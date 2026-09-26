"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toCRInputValue, crInputToUTC } from "@/lib/workPeriod";

export interface StuckShift {
  _id: string;
  staffName: string;
  staffRole: string;
  startedAt: string;
}

interface CloseStuckShiftDialogProps {
  shift: StuckShift | null;
  onClose: () => void;
  onClosed: () => void;
}

export default function CloseStuckShiftDialog({ shift, onClose, onClosed }: CloseStuckShiftDialogProps) {
  const [endedAt, setEndedAt] = useState(() => toCRInputValue(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!shift) return null;

  async function handleConfirm() {
    if (!shift) return;
    setError("");
    const parsed = crInputToUTC(endedAt);
    if (!parsed) {
      setError("Hora de salida inválida");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/work-shifts/${shift._id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endedAt: parsed.toISOString(), note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo cerrar el turno");
        return;
      }
      onClosed();
    } catch {
      setError("No se pudo cerrar el turno. Revisá tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!shift} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar jornada de {shift.staffName}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>El turno quedará marcado como <strong>ajustado</strong>, con tu nombre y la nota que escribas.</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Hora de salida real</label>
            <input
              type="datetime-local"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Nota</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ej: se le olvidó marcar la salida, confirmado con la persona."
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? "Guardando..." : "Cerrar jornada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
