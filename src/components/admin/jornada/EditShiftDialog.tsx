"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DateTime12hInput from "@/components/admin/DateTime12hInput";
import { toCRInputValue, crInputToUTC, formatCRTime, formatHoursMinutes } from "@/lib/workPeriod";

export interface EditableShift {
  _id: string;
  staffName: string;
  status: "abierta" | "cerrada";
  startedAt: string;
  endedAt: string | null;
  /** Lo que la persona marcó de verdad, si la jornada ya fue editada antes. */
  originalStartedAt?: string | null;
  originalEndedAt?: string | null;
}

interface EditShiftDialogProps {
  shift: EditableShift | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Montalo con key={shift._id}: los valores iniciales salen de las horas actuales de la jornada. */
export default function EditShiftDialog({ shift, onClose, onSaved }: EditShiftDialogProps) {
  const [startedAt, setStartedAt] = useState(() => (shift ? toCRInputValue(new Date(shift.startedAt)) : ""));
  const [endedAt, setEndedAt] = useState(() => (shift?.endedAt ? toCRInputValue(new Date(shift.endedAt)) : ""));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!shift) return null;
  const isOpen = shift.status === "abierta";

  const startUTC = crInputToUTC(startedAt);
  const endUTC = isOpen ? null : crInputToUTC(endedAt);
  const previewMinutes = startUTC && endUTC && endUTC > startUTC
    ? Math.round((endUTC.getTime() - startUTC.getTime()) / 60000)
    : null;

  const markedStart = shift.originalStartedAt ?? null;
  const markedEnd = shift.originalEndedAt ?? null;

  async function handleSave() {
    if (!shift) return;
    setError("");
    if (!startUTC) {
      setError("Hora de entrada inválida");
      return;
    }
    if (!isOpen && !endUTC) {
      setError("Hora de salida inválida");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/work-shifts/${shift._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: startUTC.toISOString(), endedAt: endUTC?.toISOString() ?? null, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la jornada");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo guardar la jornada. Revisá tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  const maxInput = toCRInputValue(new Date());

  return (
    <Dialog open={!!shift} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar jornada de {shift.staffName}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              La jornada quedará marcada como <strong>ajustada</strong>. Se guarda quién la editó, la nota y
              las horas de antes.
              {(markedStart || markedEnd) && (
                <>
                  {" "}Había marcado: entrada {formatCRTime(new Date(markedStart ?? shift.startedAt))}
                  {!isOpen && shift.endedAt && `, salida ${formatCRTime(new Date(markedEnd ?? shift.endedAt))}`}
                </>
              )}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Entrada</label>
              <DateTime12hInput value={startedAt} max={maxInput} onChange={setStartedAt} />
            </div>
            {!isOpen && (
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Salida</label>
                <DateTime12hInput value={endedAt} max={maxInput} onChange={setEndedAt} />
              </div>
            )}
          </div>

          {isOpen ? (
            <p className="text-xs text-brand-dark/50">
              Jornada en curso: la salida se marca con el PIN o con «Cerrar jornada».
            </p>
          ) : (
            <p className="text-sm text-brand-dark/70">
              Duración: <strong>{previewMinutes !== null ? formatHoursMinutes(previewMinutes) : "—"}</strong>
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Nota</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ej: entró a las 2:00 p. m., no pudo marcar por falta de internet."
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
