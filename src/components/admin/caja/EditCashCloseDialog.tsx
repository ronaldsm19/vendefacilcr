"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CASH_DENOMINATIONS, MAX_DENOMINATION_COUNT, expectedCash } from "@/lib/cashCount";

export interface EditableCashClose {
  _id: string;
  closeNumber?: number;
  closeDate: string;
  openingAmount?: number;
  paymentBreakdown: { efectivo: number; sinpe: number; tarjeta: number };
  withdrawalsTotal?: number;
  cashLeft?: number;
  notes?: string;
  arqueo?: { denominaciones?: { valor: number; cantidad: number }[] };
}

interface EditCashCloseDialogProps {
  close: EditableCashClose;
  /** Solo en el último cierre y antes de volver a abrir la caja: después ese monto ya se usó. */
  canEditCashLeft: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;
}

function countsOf(close: EditableCashClose): Record<number, number> {
  const counts: Record<number, number> = Object.fromEntries(CASH_DENOMINATIONS.map((d) => [d.valor, 0]));
  for (const d of close.arqueo?.denominaciones ?? []) counts[d.valor] = d.cantidad;
  return counts;
}

/**
 * Edita un cierre ya hecho (de hoy o de otro día): el conteo del arqueo, lo que quedó en caja y las
 * notas. El efectivo esperado sale de lo guardado en ese cierre, no de las ventas de hoy, y el
 * servidor lo vuelve a calcular igual. Pide la contraseña de eliminación.
 */
export default function EditCashCloseDialog({ close, canEditCashLeft, onClose, onSaved }: EditCashCloseDialogProps) {
  const [initialCounts] = useState(() => countsOf(close));
  const [counts, setCounts] = useState(initialCounts);
  const [cashLeft, setCashLeft] = useState(String(close.cashLeft ?? 0));
  const [notes, setNotes] = useState(close.notes ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const esperado = expectedCash(close);
  const totalContado = CASH_DENOMINATIONS.reduce((s, d) => s + d.valor * (counts[d.valor] ?? 0), 0);
  const diferencia = totalContado - esperado;
  const countsChanged = CASH_DENOMINATIONS.some((d) => (counts[d.valor] ?? 0) !== (initialCounts[d.valor] ?? 0));
  const cashLeftAmount = cashLeft.trim() === "" ? NaN : Number(cashLeft);
  const cashLeftValid = Number.isFinite(cashLeftAmount) && cashLeftAmount >= 0;
  const cashLeftChanged = canEditCashLeft && cashLeftValid && cashLeftAmount !== (close.cashLeft ?? 0);
  const notesChanged = notes !== (close.notes ?? "");
  const hasChanges = countsChanged || cashLeftChanged || notesChanged;
  const canSave = hasChanges && !!password && (!canEditCashLeft || cashLeftValid) && !saving;

  function setCount(valor: number, raw: string) {
    const n = Math.min(MAX_DENOMINATION_COUNT, Math.max(0, parseInt(raw) || 0));
    setCounts((prev) => ({ ...prev, [valor]: n }));
  }

  async function handleSave() {
    if (!canSave) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cash-close/${close._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(countsChanged
            ? { arqueo: { denominaciones: CASH_DENOMINATIONS.map((d) => ({ valor: d.valor, cantidad: counts[d.valor] ?? 0 })) } }
            : {}),
          ...(cashLeftChanged ? { cashLeft: cashLeftAmount } : {}),
          ...(notesChanged ? { notes } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudieron guardar los cambios");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudieron guardar los cambios. Revisá tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  const summary = [
    { label: "Caja inicial",     value: fmt(close.openingAmount ?? 0) },
    { label: "Efectivo vendido", value: fmt(close.paymentBreakdown?.efectivo ?? 0) },
    { label: "Retiros",          value: `−${fmt(close.withdrawalsTotal ?? 0)}` },
    { label: "Esperado",         value: fmt(esperado) },
  ];

  const column = (tipo: "moneda" | "billete", title: string) => (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark/40 mb-2">{title}</p>
      <div className="space-y-1">
        {CASH_DENOMINATIONS.filter((d) => d.tipo === tipo).map((d) => (
          <div key={d.valor} className="flex items-center gap-2">
            <label htmlFor={`edit-close-${d.valor}`} className="text-xs text-brand-dark w-14 shrink-0">{d.label}</label>
            <input
              id={`edit-close-${d.valor}`}
              type="number" min={0} step={1} inputMode="numeric"
              value={counts[d.valor] || ""} placeholder="0"
              onChange={(e) => setCount(d.valor, e.target.value)}
              className="w-16 text-center border border-brand-muted rounded-md px-1.5 py-1 text-xs focus:outline-none focus:border-brand-pink"
            />
            <span className="text-[11px] text-brand-dark/50 tabular-nums flex-1 text-right">
              {d.valor * (counts[d.valor] ?? 0) > 0 ? fmt(d.valor * (counts[d.valor] ?? 0)) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar cierre{close.closeNumber ? ` #${close.closeNumber}` : ""}</DialogTitle>
          <DialogDescription>
            {new Date(close.closeDate).toLocaleDateString("es-CR", { day: "2-digit", month: "long", year: "numeric" })}.
            {" "}El esperado sale de lo guardado en este cierre.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {summary.map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-xs text-brand-dark/50">{s.label}</p>
                <p className="text-sm font-semibold text-brand-dark tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm font-medium text-brand-dark">Arqueo</p>
              <p className="text-right">
                <span className="block text-[10px] text-brand-dark/40 uppercase tracking-wider">Total contado</span>
                <span className="text-lg font-bold tabular-nums text-brand-dark">{fmt(totalContado)}</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {column("moneda", "Monedas")}
              {column("billete", "Billetes")}
            </div>
            {totalContado > 0 && (
              <div className={`flex justify-between items-center text-xs font-semibold rounded-lg px-3 py-2 ${
                diferencia === 0 ? "bg-emerald-50 text-emerald-700" : diferencia < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
              }`}>
                <span>{diferencia === 0 ? "✓ Cuadra exacto" : diferencia < 0 ? "⚠ Faltante" : "ℹ Sobrante"}</span>
                <span className="tabular-nums">{diferencia !== 0 && `${diferencia > 0 ? "+" : ""}${fmt(diferencia)}`}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-close-cash-left" className="block text-sm font-medium text-brand-dark mb-1">Dejo en caja</label>
              {canEditCashLeft ? (
                <>
                  <input
                    id="edit-close-cash-left"
                    type="number" min={0} step={1} inputMode="numeric"
                    value={cashLeft} placeholder="0"
                    onChange={(e) => setCashLeft(e.target.value)}
                    className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
                  />
                  <p className="text-xs text-brand-dark/50 mt-1">Es la caja inicial de la próxima apertura.</p>
                </>
              ) : (
                <>
                  <p id="edit-close-cash-left" className="flex items-center gap-2 border border-brand-muted bg-gray-50 rounded-xl px-3 py-2 text-sm text-brand-dark/70">
                    <Lock className="w-3.5 h-3.5 shrink-0" /> {fmt(close.cashLeft ?? 0)}
                  </p>
                  <p className="text-xs text-brand-dark/50 mt-1">Ya se usó como caja inicial de la apertura siguiente.</p>
                </>
              )}
            </div>
            <div>
              <label htmlFor="edit-close-notes" className="block text-sm font-medium text-brand-dark mb-1">Observaciones</label>
              <textarea
                id="edit-close-notes"
                rows={3}
                value={notes} placeholder="Notas (opcional)"
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-close-password" className="block text-sm font-medium text-brand-dark mb-1">
              Contraseña de eliminación
            </label>
            <input
              id="edit-close-password"
              type="password" autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              className="w-full sm:w-1/2 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
