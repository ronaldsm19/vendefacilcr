"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC } from "@/lib/billing";
import { PROOF_LIMITS, PROOF_METHODS, PROOF_TYPES } from "@/lib/mensualidad";

/** Fotos más pesadas que esto se achican en el navegador antes de subir. */
const SHRINK_OVER_BYTES = 2.5 * 1024 * 1024;
const MAX_SIDE = 2400;

/**
 * Achica una foto grande (la cámara del teléfono saca archivos de 5 a 10 MB) a JPEG. Un pantallazo
 * normal pesa mucho menos y se sube tal cual.
 */
async function shrinkIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SHRINK_OVER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export interface UploadTarget { id: string; period: string; amount: number }

export default function ProofUploadDialog({
  target, today, onClose, onUploaded,
}: {
  target: UploadTarget;
  /** Hoy en Costa Rica (AAAA-MM-DD): la fecha por defecto y la máxima. */
  today: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<string>("sinpe");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (picked: File | undefined) => {
    setError("");
    if (!picked) return;
    if (!PROOF_TYPES[picked.type] && !picked.type.startsWith("image/")) {
      setError("Subí una imagen (JPG, PNG o WEBP) o un PDF.");
      return;
    }
    setPreparing(true);
    const ready = await shrinkIfNeeded(picked);
    setPreparing(false);
    if (!PROOF_TYPES[ready.type]) {
      setError("Ese formato de imagen no se puede subir. Probá con un pantallazo (JPG o PNG).");
      return;
    }
    if (ready.size > PROOF_LIMITS.maxBytes) {
      setError("El archivo pasa de 4 MB. Si es un PDF, probá con un pantallazo del comprobante.");
      return;
    }
    setFile(ready);
    setPreview(ready.type.startsWith("image/") ? URL.createObjectURL(ready) : "");
  };

  const clear = () => {
    setFile(null);
    setPreview("");
  };

  const submit = async () => {
    if (!file) {
      setError("Falta el comprobante.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("paidOn", paidOn);
      form.append("method", method);
      form.append("reference", reference);
      form.append("note", note);
      const res = await fetch(`/api/admin/mensualidad/${target.id}/comprobantes`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir el comprobante");
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el comprobante");
      setSaving(false);
    }
  };

  const input = "w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink";

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Subir comprobante</DialogTitle>
          <DialogDescription>
            Mensualidad de {target.period} · <strong className="text-brand-dark tabular-nums">{formatCRC(target.amount)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 space-y-4">
          <div>
            <span className="block text-sm font-medium text-brand-dark mb-1">Pantallazo o PDF del pago</span>
            {file ? (
              <div className="relative rounded-xl border border-brand-muted overflow-hidden bg-brand-muted/30">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Comprobante elegido" className="w-full max-h-64 object-contain" />
                ) : (
                  <div className="flex items-center gap-2 px-4 py-6 text-sm text-brand-dark/70">
                    <FileText className="w-5 h-5 shrink-0" aria-hidden />
                    <span className="truncate">{file.name}</span>
                  </div>
                )}
                <button
                  type="button" onClick={clear} disabled={saving}
                  className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow cursor-pointer"
                  aria-label="Quitar el archivo"
                >
                  <X className="w-4 h-4 text-brand-dark" aria-hidden />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-brand-muted rounded-xl py-8 px-4 text-sm text-brand-dark/60 cursor-pointer hover:border-brand-pink text-center">
                {preparing ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Upload className="w-5 h-5" aria-hidden />
                    <span className="font-medium text-brand-dark">Elegir el archivo</span>
                    <span className="text-xs">Imagen o PDF, hasta 4 MB</span>
                  </>
                )}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp,application/pdf,image/*" className="sr-only"
                  disabled={preparing}
                  onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }}
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-brand-dark mb-1">Fecha del pago</span>
              <input type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-brand-dark mb-1">Cómo pagaste</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${input} bg-white`}>
                {PROOF_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-brand-dark mb-1">
              Referencia <span className="text-brand-dark/45 font-normal">(opcional)</span>
            </span>
            <input
              value={reference} maxLength={PROOF_LIMITS.reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Número del comprobante" className={input}
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-brand-dark mb-1">
              Nota <span className="text-brand-dark/45 font-normal">(opcional)</span>
            </span>
            <input
              value={note} maxLength={PROOF_LIMITS.note} onChange={(e) => setNote(e.target.value)}
              placeholder="Por ejemplo: pagué en dos partes" className={input}
            />
          </label>

          {error && <p role="alert" className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button variant="cancel" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={submit} disabled={saving || preparing || !file}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : "Enviar comprobante"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
