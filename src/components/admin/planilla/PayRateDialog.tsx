"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAY_MODES, PAY_MODE_LABELS, type PayMode, type PayrollRow } from "@/lib/payroll";

/**
 * Tarifa y teléfono de una persona.
 *
 * La tarifa que se guarda acá es la vigente; cada pago congela la suya, así que subirle el
 * sueldo mañana no reescribe lo que ya se le pagó.
 */
export default function PayRateDialog({
  row,
  onClose,
  onSaved,
}: {
  row: PayrollRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<PayMode>(row.pay.mode);
  const [rate, setRate] = useState(String(row.pay.rate || ""));
  const [includesService, setIncludesService] = useState(row.pay.includesService);
  const [notes, setNotes] = useState(row.pay.notes);
  const [phone, setPhone] = useState(row.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/staff-users/${row.staffUserId}/pay`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pay: { mode, rate: Number(rate) || 0, includesService, notes },
          phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4">
          <DialogTitle>Tarifa de {row.name}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Cómo se le paga</label>
            <div className="grid grid-cols-2 gap-2">
              {PAY_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                    mode === m
                      ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                      : "border-brand-muted text-brand-dark/60"
                  }`}
                >
                  {PAY_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Monto en colones{" "}
              <span className="text-brand-dark/40 font-normal">
                ({mode === "hora" ? "por hora" : mode === "dia" ? "por día" : mode === "quincena" ? "por quincena" : "por mes"})
              </span>
            </label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
              className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
            />
            {mode === "quincena" || mode === "mes" ? (
              <p className="text-xs text-brand-dark/40 mt-1">
                Un fijo no mira las horas: se paga completo aunque las horas marcadas sean menos.
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includesService}
              onChange={(e) => setIncludesService(e.target.checked)}
              className="mt-1 accent-brand-pink w-4 h-4"
            />
            <span>
              <span className="block text-sm font-medium text-brand-dark">Le toca 10% de servicio</span>
              <span className="block text-xs text-brand-dark/50">
                Se le suma aparte del sueldo, repartido según sus horas del período.
              </span>
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">
              Teléfono <span className="text-brand-dark/40 font-normal">(para mandarle el comprobante)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="8888 8888"
              className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Nota interna</label>
            <input
              type="text"
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
