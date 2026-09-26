"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatHoursMinutes, type PeriodRange } from "@/lib/workPeriod";
import {
  METHODS_WITH_PROOF,
  PAY_METHODS,
  PAY_METHOD_LABELS,
  PAY_LINE_LABELS,
  amountForPay,
  isNegativeKind,
  money,
  type PayLineKind,
  type PayMethod,
  type PayrollRow,
  type UnpaidShift,
} from "@/lib/payroll";

/**
 * Registrar un pago.
 *
 * La línea de horas y la del 10% las calcula el SERVIDOR con la tarifa guardada; acá se
 * muestran para que la dueña vea lo mismo que se va a guardar, pero no se mandan. Lo que sí
 * viaja son las líneas que ella agrega: bonos, adelantos, deducciones.
 */

interface ExtraLine {
  id: string;
  kind: PayLineKind;
  label: string;
  amount: string;
}

const EXTRA_KINDS: PayLineKind[] = ["bono", "propina", "adelanto", "deduccion", "otro"];

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short" });
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
}

export default function PayDialog({
  row,
  period,
  onClose,
  onSaved,
}: {
  row: PayrollRow;
  period: PeriodRange;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [shifts, setShifts] = useState<UnpaidShift[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [extras, setExtras] = useState<ExtraLine[]>([]);
  const [method, setMethod] = useState<PayMethod>("efectivo");
  const [reference, setReference] = useState("");
  // Del pantallazo se guardan dos cosas: la ruta interna, que es lo que viaja al servidor, y
  // un enlace firmado que solo sirve para la vista previa de este diálogo.
  const [proofImage, setProofImage] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/payroll/staff/${row.staffUserId}`);
    if (!res.ok) {
      setError("No se pudieron cargar los turnos");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const list: UnpaidShift[] = data.unpaidShifts ?? [];
    setShifts(list);
    // Todos marcados por defecto: lo normal es pagar todo lo que se debe.
    setChosen(new Set(list.map((s) => s._id)));
    setLoading(false);
  }, [row.staffUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selected = shifts.filter((s) => chosen.has(s._id));
  const minutes = selected.reduce((s, x) => s + x.minutes, 0);
  const days = new Set(selected.map((s) => s.day)).size;
  const hoursAmount = amountForPay(row.pay, minutes, days);

  const extrasTotal = extras.reduce((s, l) => {
    const magnitude = Math.round(Math.abs(Number(l.amount) || 0));
    return s + (isNegativeKind(l.kind) ? -magnitude : magnitude);
  }, 0);
  // El 10% no se puede anticipar acá: lo calcula el servidor con las ventas del período.
  const estimated = hoursAmount + extrasTotal;

  const addExtra = () =>
    setExtras((prev) => [
      ...prev,
      { id: `x${Date.now()}${prev.length}`, kind: "bono", label: "", amount: "" },
    ]);

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      // Almacén privado: el pantallazo de un SINPE lleva datos bancarios y no puede quedar
      // en una dirección que abre cualquiera que la tenga.
      const res = await fetch("/api/admin/payroll/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir la imagen");
      setProofImage(data.path);
      setProofUrl(data.url ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (selected.length === 0) {
      setError("Elegí al menos un turno");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/payroll/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffUserId: row.staffUserId,
          shiftIds: selected.map((s) => s._id),
          extraLines: extras
            .filter((l) => Number(l.amount) > 0)
            .map((l) => ({
              kind: l.kind,
              label: l.label.trim() || PAY_LINE_LABELS[l.kind],
              amount: Math.round(Number(l.amount)),
            })),
          method,
          reference,
          proofImage,
          // Si es hoy se manda el instante real; para una fecha pasada, el mediodía de Costa
          // Rica, que es la hora que no se corre de día al convertirse a UTC.
          paidAt:
            paidAt === new Date().toISOString().slice(0, 10)
              ? new Date().toISOString()
              : new Date(`${paidAt}T12:00:00-06:00`).toISOString(),
          notes,
          periodFrom: period.from.toISOString(),
          periodTo: period.to.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo registrar el pago");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el pago");
    } finally {
      setSaving(false);
    }
  };

  const needsProof = METHODS_WITH_PROOF.includes(method);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pb-4">
          <DialogTitle>Pagarle a {row.name}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-brand-dark/40">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : shifts.length === 0 ? (
            <p className="text-sm text-brand-dark/50">No hay horas pendientes de pago.</p>
          ) : (
            <>
              {/* Turnos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-brand-dark">Horas que se pagan</p>
                  <button
                    type="button"
                    onClick={() =>
                      setChosen(chosen.size === shifts.length ? new Set() : new Set(shifts.map((s) => s._id)))
                    }
                    className="text-xs font-medium text-brand-pink cursor-pointer"
                  >
                    {chosen.size === shifts.length ? "Ninguno" : "Todos"}
                  </button>
                </div>
                <ul className="max-h-52 overflow-y-auto space-y-1.5 border border-brand-muted rounded-xl p-2">
                  {shifts.map((s) => (
                    <li key={s._id}>
                      <label className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-brand-muted/40 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={chosen.has(s._id)}
                          onChange={() => toggle(s._id)}
                          className="accent-brand-pink w-4 h-4"
                        />
                        <span className="flex-1 text-sm text-brand-dark capitalize">{dayLabel(s.startedAt)}</span>
                        <span className="text-xs text-brand-dark/40">
                          {timeLabel(s.startedAt)}–{timeLabel(s.endedAt)}
                        </span>
                        <span className="text-sm font-semibold text-brand-dark tabular-nums w-16 text-right">
                          {formatHoursMinutes(s.minutes)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Desglose */}
              <div className="bg-brand-muted/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-dark/70">
                    Horas trabajadas · {formatHoursMinutes(minutes)}
                    {row.pay.mode === "dia" ? ` · ${days} día${days === 1 ? "" : "s"}` : ""}
                  </span>
                  <span className="font-semibold text-brand-dark">{money(hoursAmount)}</span>
                </div>

                {row.pay.includesService && (
                  <p className="text-xs text-brand-dark/50">
                    Se le suma el 10% de servicio del período; el monto lo calcula el sistema al guardar.
                  </p>
                )}

                {extras.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <select
                      value={l.kind}
                      onChange={(e) =>
                        setExtras((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, kind: e.target.value as PayLineKind } : x))
                        )
                      }
                      className="border border-brand-muted rounded-lg px-2 py-1.5 text-xs bg-white"
                    >
                      {EXTRA_KINDS.map((k) => (
                        <option key={k} value={k}>{PAY_LINE_LABELS[k]}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={l.label}
                      onChange={(e) =>
                        setExtras((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder="Detalle"
                      className="flex-1 min-w-0 border border-brand-muted rounded-lg px-2 py-1.5 text-xs bg-white"
                    />
                    <input
                      type="number"
                      min={0}
                      value={l.amount}
                      onChange={(e) =>
                        setExtras((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^\d]/g, "") } : x))
                        )
                      }
                      placeholder="0"
                      className="w-24 border border-brand-muted rounded-lg px-2 py-1.5 text-xs text-right bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                      className="p-1.5 rounded-lg text-brand-dark/40 hover:text-red-500 cursor-pointer"
                      aria-label="Quitar línea"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addExtra}
                  className="flex items-center gap-1 text-xs font-medium text-brand-pink cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar bono, adelanto o deducción
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-brand-muted">
                  <span className="text-sm font-medium text-brand-dark">Total</span>
                  <span className="text-xl font-bold text-brand-pink">{money(estimated)}</span>
                </div>
              </div>

              {/* Método */}
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Cómo se pagó</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAY_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                        method === m
                          ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                          : "border-brand-muted text-brand-dark/60"
                      }`}
                    >
                      {PAY_METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {needsProof && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-brand-dark mb-1">
                      Referencia <span className="text-brand-dark/40 font-normal">(número del comprobante)</span>
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Opcional"
                      className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-brand-dark mb-1">Pantallazo</label>
                    {proofImage && proofUrl ? (
                      <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-brand-muted">
                        <Image src={proofUrl} alt="Comprobante" fill className="object-cover" sizes="160px" />
                        <button
                          type="button"
                          onClick={() => { setProofImage(""); setProofUrl(""); }}
                          className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow cursor-pointer"
                          aria-label="Quitar imagen"
                        >
                          <X className="w-3.5 h-3.5 text-brand-dark" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 border border-dashed border-brand-muted rounded-xl py-6 text-sm text-brand-dark/50 cursor-pointer hover:border-brand-pink">
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4" /> Subir el pantallazo
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) upload(f);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1">Fecha del pago</label>
                  <input
                    type="date"
                    value={paidAt}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-1">Nota</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                    className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

              <div className="flex gap-3">
                <Button variant="cancel" className="flex-1" onClick={onClose}>Cancelar</Button>
                <Button className="flex-1" disabled={saving || selected.length === 0} onClick={save}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Registrar ${money(estimated)}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
