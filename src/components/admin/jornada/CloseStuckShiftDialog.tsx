"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DateTime12hInput from "@/components/admin/DateTime12hInput";
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
  // Aviso de jornada larga: el servidor lo devuelve con código LONG_SHIFT y hay que reintentar
  // confirmando. Se guarda el texto que él mismo calculó, que ya trae las horas.
  const [longWarning, setLongWarning] = useState("");

  if (!shift) return null;

  async function send(confirmLong: boolean) {
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
        body: JSON.stringify({ endedAt: parsed.toISOString(), note, confirmLong }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "LONG_SHIFT") {
          setLongWarning(data.error ?? "Esta jornada quedaría muy larga.");
          return;
        }
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

  // Cambiar la hora deja sin efecto el aviso: es justamente lo que se le pidió que hiciera.
  function handleTimeChange(v: string) {
    setEndedAt(v);
    setLongWarning("");
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
            <DateTime12hInput value={endedAt} max={toCRInputValue(new Date())} onChange={handleTimeChange} />
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

          {longWarning && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {longWarning} Esas horas van a contar en el reporte y en lo que se le paga.
              </span>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {longWarning ? (
            <Button type="button" variant="destructive" onClick={() => send(true)} disabled={saving}>
              {saving ? "Guardando..." : "Cerrar así de todos modos"}
            </Button>
          ) : (
            <Button type="button" onClick={() => send(false)} disabled={saving}>
              {saving ? "Guardando..." : "Cerrar jornada"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
