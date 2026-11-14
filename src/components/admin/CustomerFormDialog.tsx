"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, CheckCircle2, AlertTriangle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ID_TYPES, ID_TYPE_LABELS, formatIdNumber, guessIdType, idNumberError, normalizeIdNumber,
  type CustomerView, type IdType,
} from "@/lib/customerId";
import type { HaciendaActivity, HaciendaLookup } from "@/server/services/haciendaLookup";

/**
 * Alta y edición de un cliente que pide factura. Se escribe la cédula, "Buscar en Hacienda" llena
 * nombre, tipo y actividad, y la caja solo completa el correo. Si Hacienda no responde se llena a
 * mano: nunca se queda nadie sin poder registrar.
 *
 * Lo usa la página Clientes y, en el cobro, el selector de cliente.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Para editar. Sin él, es un alta. */
  customer?: CustomerView | null;
  /** Cédula ya escrita en un buscador, para no volver a teclearla. */
  initialIdNumber?: string;
  /** Al guardar, o al elegir "Usar este cliente" cuando la cédula ya estaba registrada. */
  onSaved: (customer: CustomerView) => void;
}

const INPUT = "w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink";

interface FormState {
  idType: IdType;
  idNumber: string;
  name: string;
  email: string;
  ccEmails: string;
  phone: string;
  activityCode: string;
  activityName: string;
  haciendaRegime: string;
  notes: string;
}

function emptyForm(initialIdNumber = ""): FormState {
  const digits = normalizeIdNumber(initialIdNumber);
  return {
    idType: guessIdType(digits) ?? "01",
    idNumber: digits,
    name: "", email: "", ccEmails: "", phone: "",
    activityCode: "", activityName: "", haciendaRegime: "", notes: "",
  };
}

function fromCustomer(c: CustomerView): FormState {
  return {
    idType: c.idType,
    idNumber: c.idNumber,
    name: c.name,
    email: c.email,
    ccEmails: c.ccEmails.join(", "),
    phone: c.phone,
    activityCode: c.activityCode,
    activityName: c.activityName,
    haciendaRegime: c.haciendaRegime,
    notes: c.notes,
  };
}

type LookupNote =
  | { kind: "found"; text: string }
  | { kind: "warn"; text: string }
  | null;

export default function CustomerFormDialog({ open, onClose, customer, initialIdNumber, onSaved }: Props) {
  const editing = !!customer;
  const [form, setForm] = useState<FormState>(() => (customer ? fromCustomer(customer) : emptyForm(initialIdNumber)));
  const [activities, setActivities] = useState<HaciendaActivity[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [note, setNote] = useState<LookupNote>(null);
  const [existing, setExisting] = useState<CustomerView | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Cada vez que se abre arranca limpio (o con el cliente a editar).
  useEffect(() => {
    if (!open) return;
    setForm(customer ? fromCustomer(customer) : emptyForm(initialIdNumber));
    setActivities([]);
    setNote(null);
    setExisting(null);
    setError("");
  }, [open, customer, initialIdNumber]);

  const digits = normalizeIdNumber(form.idNumber);
  const canLookup = /^\d{9,12}$/.test(digits) && !lookingUp;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onIdNumberChange(value: string) {
    const clean = value.replace(/[^\d\s-]/g, "").slice(0, 16);
    const guessed = guessIdType(normalizeIdNumber(clean));
    // El tipo se sugiere solo al dar de alta: al editar ya está elegido a propósito.
    setForm((f) => ({ ...f, idNumber: clean, idType: !editing && guessed ? guessed : f.idType }));
    setExisting(null);
  }

  async function lookup() {
    if (!canLookup) return;
    setLookingUp(true);
    setNote(null);
    setError("");
    try {
      const res = await fetch(`/api/admin/invoice-customers/lookup?id=${digits}`);
      const data = await res.json();
      const found: CustomerView | null = data.existing ?? null;
      if (found && found._id !== customer?._id) setExisting(found);

      if (!res.ok) {
        setNote({ kind: "warn", text: data.error ?? "No pudimos consultar Hacienda. Llenalo a mano." });
        return;
      }
      const h: HaciendaLookup = data.hacienda;
      if (h.status === "found") {
        const main = h.activities[0];
        setActivities(h.activities);
        setForm((f) => ({
          ...f,
          idType: h.idType ?? f.idType,
          name: h.name,
          haciendaRegime: h.regime,
          activityCode: main?.code ?? "",
          activityName: main?.name ?? "",
        }));
        const bits = [h.regime, h.taxStatus].filter(Boolean).join(" · ");
        setNote({ kind: "found", text: bits ? `Datos de Hacienda: ${bits}` : "Datos traídos de Hacienda" });
      } else if (h.status === "not_found") {
        setNote({ kind: "warn", text: "Hacienda no tiene esa identificación. Revisá el número o llenalo a mano." });
      } else {
        setNote({ kind: "warn", text: `${h.reason}. Llenalo a mano.` });
      }
    } catch {
      setNote({ kind: "warn", text: "No pudimos consultar Hacienda. Llenalo a mano." });
    } finally {
      setLookingUp(false);
    }
  }

  async function save() {
    const idError = idNumberError(form.idType, digits);
    if (idError) { setError(idError); return; }
    if (!form.name.trim()) { setError("Escribí el nombre o la razón social"); return; }
    if (!form.email.trim()) { setError("Escribí el correo: ahí le llega la factura"); return; }

    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        idNumber: digits,
        ccEmails: form.ccEmails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean),
      };
      const res = await fetch(
        editing ? `/api/admin/invoice-customers/${customer!._id}` : "/api/admin/invoice-customers",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (res.status === 409 && data.customer) {
        setExisting(data.customer);
        setError("");
        return;
      }
      if (!res.ok) { setError(data.error ?? "No se pudo guardar"); return; }
      onSaved(data.customer);
    } catch {
      setError("No se pudo guardar. Revisá la conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4">
          <DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Tipo de identificación</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ID_TYPES.map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => set("idType", t)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    form.idType === t ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/60"
                  }`}
                >
                  {ID_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Número</label>
            <div className="flex gap-2">
              <input
                type="text" inputMode="numeric" autoComplete="off" value={form.idNumber}
                placeholder={form.idType === "02" ? "3-101-123456" : form.idType === "01" ? "1-2345-6789" : ""}
                onChange={(e) => onIdNumberChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(); } }}
                className={`${INPUT} font-mono`}
              />
              <Button type="button" variant="secondary" className="shrink-0" disabled={!canLookup} onClick={lookup}>
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                {!lookingUp && "Buscar en Hacienda"}
              </Button>
            </div>
            {note && (
              <p className={`mt-2 flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${
                note.kind === "found" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}>
                {note.kind === "found"
                  ? <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />}
                {note.text}
              </p>
            )}
          </div>

          {existing && (
            <div className="rounded-xl border border-brand-pink/30 bg-brand-pink/5 px-3 py-3 space-y-2">
              <p className="text-sm text-brand-dark">
                <span className="font-semibold">Ya está registrado:</span> {existing.name}{" "}
                <span className="text-brand-dark/50">({formatIdNumber(existing.idType, existing.idNumber)})</span>
              </p>
              <Button type="button" size="sm" onClick={() => onSaved(existing)}>
                <UserCheck className="w-3.5 h-3.5 mr-1" /> Usar este cliente
              </Button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Nombre o razón social</label>
            <input type="text" maxLength={160} value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT} />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Correo</label>
            <input
              type="email" maxLength={160} autoCapitalize="none" value={form.email}
              onChange={(e) => set("email", e.target.value)} className={INPUT}
            />
            <p className="text-xs text-brand-dark/40 mt-1">Ahí le llega la factura.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Teléfono <span className="font-normal text-brand-dark/40">(opcional)</span></label>
              <input type="tel" maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Copias <span className="font-normal text-brand-dark/40">(opcional)</span></label>
              <input
                type="text" autoCapitalize="none" value={form.ccEmails} placeholder="contabilidad@empresa.com"
                onChange={(e) => set("ccEmails", e.target.value)} className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Actividad económica <span className="font-normal text-brand-dark/40">(opcional)</span></label>
            {activities.length > 1 ? (
              <select
                value={form.activityCode}
                onChange={(e) => {
                  const a = activities.find((x) => x.code === e.target.value);
                  setForm((f) => ({ ...f, activityCode: a?.code ?? "", activityName: a?.name ?? "" }));
                }}
                className={`${INPUT} bg-white`}
              >
                {activities.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}{a.primary ? " (principal)" : ""}</option>
                ))}
              </select>
            ) : (
              <input
                type="text" maxLength={12} value={form.activityCode} placeholder="Se llena con Hacienda"
                onChange={(e) => setForm((f) => ({ ...f, activityCode: e.target.value, activityName: "" }))}
                className={`${INPUT} font-mono`}
              />
            )}
            {form.activityName && activities.length <= 1 && (
              <p className="text-xs text-brand-dark/50 mt-1">{form.activityName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Notas <span className="font-normal text-brand-dark/40">(opcional)</span></label>
            <textarea
              rows={2} maxLength={300} value={form.notes} onChange={(e) => set("notes", e.target.value)}
              className={`${INPUT} resize-none`}
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Guardar" : "Registrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
