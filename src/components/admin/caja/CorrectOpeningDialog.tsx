"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface OpeningToCorrect {
  openingAmount: number;
  previousCashLeft?: number | null;
  countedAmount?: number | null;
}

interface CorrectOpeningDialogProps {
  cashSession: OpeningToCorrect;
  onClose: () => void;
  onSaved: () => void;
}

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;
}

/**
 * Corrige lo que se digitó al abrir la caja. En la primera apertura del negocio eso es la caja
 * inicial; en las demás, la caja inicial es lo que quedó en el último cierre y lo digitado fue el
 * conteo, que solo sirve para avisar si falta o sobra plata.
 */
export default function CorrectOpeningDialog({ cashSession, onClose, onSaved }: CorrectOpeningDialogProps) {
  const isFirstOpening = cashSession.previousCashLeft == null;
  const current = isFirstOpening ? cashSession.openingAmount : cashSession.countedAmount;
  const [input, setInput] = useState(current != null ? String(current) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const amount = input.trim() === "" ? NaN : Number(input);
  const valid = Number.isFinite(amount) && amount >= 0;
  const changed = valid && amount !== current;
  const difference = !isFirstOpening && valid ? amount - cashSession.openingAmount : null;

  async function handleSave() {
    if (!changed) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cash-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la corrección");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo guardar la corrección. Revisá tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isFirstOpening ? "Corregir caja inicial" : "Corregir conteo de apertura"}</DialogTitle>
          <DialogDescription>
            {isFirstOpening
              ? "Si te equivocaste al abrir la caja, poné el monto correcto. El efectivo esperado del día se recalcula con este monto."
              : `La caja inicial es lo que quedó en el último cierre (${fmt(cashSession.openingAmount)}) y no cambia. Corregí lo que contaste al abrir para que el aviso de faltante o sobrante sea el correcto.`}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>El cambio queda registrado con tu nombre, la hora y el monto anterior.</span>
          </div>

          <div>
            <label htmlFor="opening-correction-amount" className="block text-sm font-medium text-brand-dark mb-1">
              {isFirstOpening ? "Caja inicial" : "Efectivo contado al abrir"}
            </label>
            <input
              id="opening-correction-amount"
              type="number" min={0} step={1} inputMode="numeric"
              value={input} placeholder="0" autoFocus
              onChange={(e) => setInput(e.target.value)}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
            <p className="text-xs text-brand-dark/50 mt-1">
              Antes: <span className="font-semibold text-brand-dark/70">{current != null ? fmt(current) : "sin dato"}</span>
            </p>
            {difference != null && (
              <p className={`text-xs font-medium mt-1 ${
                difference === 0 ? "text-emerald-600" : difference < 0 ? "text-red-600" : "text-amber-600"
              }`}>
                {difference === 0
                  ? "✓ Cuadra con el último cierre."
                  : difference < 0
                  ? `⚠ Faltan ${fmt(Math.abs(difference))} respecto al último cierre.`
                  : `ℹ Sobran ${fmt(difference)} respecto al último cierre.`}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="opening-correction-note" className="block text-sm font-medium text-brand-dark mb-1">
              Motivo <span className="font-normal text-brand-dark/40">(opcional)</span>
            </label>
            <textarea
              id="opening-correction-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Ej: digité un cero de más."
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !changed}>
            {saving ? "Guardando..." : "Guardar corrección"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
