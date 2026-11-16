"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, Bold, Loader2, Plus, Printer, Save, Trash2, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductLabelFace, { MIN_MODULE_MM, printLabels, type LabelFit } from "@/components/admin/ProductLabelFace";
import { MAX_BARCODE, normalizeBarcode } from "@/lib/barcode";
import { canEncodeCode39 } from "@/lib/code39";
import {
  LABEL_HEIGHT_MM, LABEL_LINE_SIZES, LABEL_SIZE_NAMES, LABEL_WIDTH_MM, MAX_LABEL_COPIES,
  MAX_LABEL_LINE, MAX_LABEL_LINES, defaultLabel, type LabelLine, type ProductLabelFormat,
} from "@/lib/productLabel";

export interface LabelProduct {
  _id: string;
  name: string;
  description?: string;
  barcode?: string;
  label?: ProductLabelFormat;
}

/** px por mm a 96 dpi, para escalar la vista previa al ancho disponible. */
const PX_PER_MM = 96 / 25.4;
const MAX_PREVIEW_SCALE = 1.7;

const inputClass =
  "w-full border border-brand-muted rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-pink";

/**
 * Productos → Etiqueta: arma el formato de la etiqueta adhesiva del producto (líneas de texto con
 * su tamaño, el número del código y la fila Peso · Precio · Lote), lo muestra a tamaño real a la
 * derecha mientras se edita e imprime las que se pidan.
 */
export default function LabelEditor({
  product,
  canSave,
  suggestedCode,
  onSaved,
}: {
  product: LabelProduct;
  /** Puede guardar el formato y asignar el código (permiso de editar productos). */
  canSave: boolean;
  /** Siguiente código interno libre, para el botón Generar. */
  suggestedCode: string;
  onSaved: (productId: string, changes: { label?: ProductLabelFormat; barcode?: string }) => void;
}) {
  const initial = product.label ?? defaultLabel(product);
  const [format, setFormat] = useState<ProductLabelFormat>(initial);
  // Sin formato guardado todavía, el de arranque cuenta como cambio: se puede guardar tal cual.
  const [savedFormat, setSavedFormat] = useState(product.label ? JSON.stringify(initial) : "");
  const [codeDraft, setCodeDraft] = useState("");
  const [copies, setCopies] = useState("1");
  const [busy, setBusy] = useState<"" | "save" | "print">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fit, setFit] = useState<LabelFit | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const previewBox = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1.5);
  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setPreviewScale(Math.min(MAX_PREVIEW_SCALE, entry.contentRect.width / (LABEL_WIDTH_MM * PX_PER_MM)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hasCode = !!product.barcode;
  const draft = normalizeBarcode(codeDraft);
  const code = hasCode ? product.barcode! : draft ?? "";
  const codeError =
    !hasCode && codeDraft && draft === null ? "Solo letras sin tilde, números y - . / + % $"
    : code && !canEncodeCode39(code) ? "Este código no se puede imprimir en Code 39"
    : "";
  const dirty = JSON.stringify(format) !== savedFormat;
  const copiesNum = Number(copies);
  const copiesOk = Number.isInteger(copiesNum) && copiesNum >= 1 && copiesNum <= MAX_LABEL_COPIES;

  function updateLine(i: number, patch: Partial<LabelLine>) {
    setFormat((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
    setNotice("");
  }
  function moveLine(i: number, dir: -1 | 1) {
    setFormat((f) => {
      const lines = [...f.lines];
      const j = i + dir;
      if (j < 0 || j >= lines.length) return f;
      [lines[i], lines[j]] = [lines[j], lines[i]];
      return { ...f, lines };
    });
  }
  function removeLine(i: number) {
    setFormat((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }));
  }
  function addLine() {
    setFormat((f) => ({ ...f, lines: [...f.lines, { text: "", size: "sm", bold: false }] }));
  }

  /** Lo que se guarda: sin líneas vacías. */
  function cleanFormat(): ProductLabelFormat {
    return { ...format, lines: format.lines.filter((l) => l.text.trim()).map((l) => ({ ...l, text: l.text.trim() })) };
  }

  async function saveFormat(): Promise<boolean> {
    const clean = cleanFormat();
    const res = await fetch(`/api/admin/products/${product._id}/label`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clean),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar la etiqueta");
      return false;
    }
    setFormat(data.label);
    setSavedFormat(JSON.stringify(data.label));
    onSaved(product._id, { label: data.label });
    return true;
  }

  async function saveCode(): Promise<boolean> {
    const res = await fetch(`/api/admin/products/${product._id}/barcode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar el código");
      return false;
    }
    onSaved(product._id, { barcode: data.barcode ?? code });
    return true;
  }

  async function handleSave() {
    setBusy("save");
    setError("");
    try {
      if (await saveFormat()) setNotice("Formato guardado");
    } catch {
      setError("Sin conexión, probá de nuevo");
    } finally {
      setBusy("");
    }
  }

  async function handlePrint() {
    if (!labelRef.current || !code || codeError || !copiesOk) return;
    setBusy("print");
    setError("");
    setNotice("");
    try {
      // El código nuevo se guarda antes de imprimir: si no, la etiqueta pegada no la reconoce la caja.
      if (!hasCode && !(await saveCode())) return;
      if (canSave && dirty && !(await saveFormat())) return;
      printLabels(labelRef.current, copiesNum);
    } catch {
      setError("Sin conexión, probá de nuevo");
    } finally {
      setBusy("");
    }
  }

  const tooLong = fit?.moduleMm != null && fit.moduleMm < MIN_MODULE_MM;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      {/* Editor */}
      <div className="space-y-4 min-w-0">
        <div>
          <p className="text-sm font-medium text-brand-dark mb-1">Código de barras</p>
          {hasCode ? (
            <p className="font-mono text-sm text-brand-dark">{product.barcode}</p>
          ) : canSave ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codeDraft}
                  maxLength={MAX_BARCODE}
                  autoComplete="off"
                  placeholder="Escaneá o escribí el código"
                  aria-label="Código de barras"
                  onChange={(e) => setCodeDraft(e.target.value.replace(/\s/g, "").toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  className={`${inputClass} font-mono`}
                />
                {!codeDraft && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setCodeDraft(suggestedCode)} className="shrink-0">
                    <Wand2 className="w-4 h-4" /> Generar
                  </Button>
                )}
              </div>
              <p className="text-xs text-brand-dark/50 mt-1">Este producto no tenía código. Se le guarda al imprimir.</p>
            </>
          ) : (
            <p className="text-sm text-amber-700">Este producto no tiene código. Pedile a quien administra los productos que se lo asigne.</p>
          )}
          {codeError && <p className="text-xs text-red-600 mt-1">{codeError}</p>}
        </div>

        <div>
          <p className="text-sm font-medium text-brand-dark mb-1.5">Texto de la etiqueta</p>
          <div className="space-y-2">
            {format.lines.map((line, i) => (
              <div key={i} className="rounded-xl border border-brand-muted p-2 space-y-2">
                <input
                  type="text"
                  value={line.text}
                  maxLength={MAX_LABEL_LINE}
                  placeholder="Texto de la línea"
                  aria-label={`Línea ${i + 1}`}
                  onChange={(e) => updateLine(i, { text: e.target.value })}
                  className={inputClass}
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={line.size}
                    aria-label={`Tamaño de la línea ${i + 1}`}
                    onChange={(e) => updateLine(i, { size: e.target.value as LabelLine["size"] })}
                    className="border border-brand-muted rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:border-brand-pink"
                  >
                    {LABEL_LINE_SIZES.map((s) => <option key={s} value={s}>{LABEL_SIZE_NAMES[s]}</option>)}
                  </select>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={line.bold ? "default" : "secondary"}
                    title="Negrita"
                    aria-label={`Negrita en la línea ${i + 1}`}
                    aria-pressed={line.bold}
                    onClick={() => updateLine(i, { bold: !line.bold })}
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                  <div className="ml-auto flex gap-1">
                    <Button type="button" size="icon-sm" variant="secondary" title="Subir" aria-label={`Subir la línea ${i + 1}`} disabled={i === 0} onClick={() => moveLine(i, -1)}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="secondary" title="Bajar" aria-label={`Bajar la línea ${i + 1}`} disabled={i === format.lines.length - 1} onClick={() => moveLine(i, 1)}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="destructive" title="Quitar línea" aria-label={`Quitar la línea ${i + 1}`} onClick={() => removeLine(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {format.lines.length < MAX_LABEL_LINES && (
            <Button type="button" variant="secondary" size="sm" onClick={addLine} className="mt-2">
              <Plus className="w-4 h-4" /> Agregar línea
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-brand-dark cursor-pointer">
            <input type="checkbox" checked={format.showCode} onChange={(e) => setFormat((f) => ({ ...f, showCode: e.target.checked }))} className="accent-brand-pink w-4 h-4" />
            Mostrar el número debajo de las barras
          </label>
          <label className="flex items-center gap-2 text-sm text-brand-dark cursor-pointer">
            <input type="checkbox" checked={format.weightRow} onChange={(e) => setFormat((f) => ({ ...f, weightRow: e.target.checked }))} className="accent-brand-pink w-4 h-4" />
            Agregar la fila Peso · Precio · Lote
          </label>
        </div>

        {!canSave && (
          <p className="text-xs text-brand-dark/50">Podés cambiar el texto para esta impresión. Guardarlo lo hace quien edita los productos.</p>
        )}
      </div>

      {/* Vista previa e impresión */}
      <div className="space-y-4 min-w-0 md:sticky md:top-0 self-start">
        <div ref={previewBox} className="rounded-2xl bg-brand-muted/40 p-3">
          <div
            className="mx-auto shadow-md rounded-sm overflow-hidden"
            style={{ width: LABEL_WIDTH_MM * PX_PER_MM * previewScale, height: LABEL_HEIGHT_MM * PX_PER_MM * previewScale }}
          >
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: "max-content" }}>
              <ProductLabelFace ref={labelRef} format={format} code={codeError ? "" : code} onFit={setFit} />
            </div>
          </div>
          <p className="text-xs text-brand-dark/50 text-center mt-2">Tamaño real: {LABEL_WIDTH_MM} × {LABEL_HEIGHT_MM} mm</p>
        </div>

        {fit?.overflow && (
          <p className="flex items-start gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> El texto no cabe y se va a cortar. Quitá alguna línea o acortala.
          </p>
        )}
        {!fit?.overflow && fit && fit.scale < 1 && (
          <p className="text-xs text-brand-dark/50">El texto se achicó un poco para que quepa.</p>
        )}
        {tooLong && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> El código es largo para esta etiqueta: las barras quedan muy finas y el lector podría no leerlo.
          </p>
        )}

        <div className="flex items-end gap-2">
          <div className="w-24 shrink-0">
            <label htmlFor="label-copies" className="block text-sm font-medium text-brand-dark mb-1">Cantidad</label>
            <input
              id="label-copies"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LABEL_COPIES}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button
            type="button"
            className="flex-1"
            disabled={!!busy || !code || !!codeError || !copiesOk || (!hasCode && !canSave)}
            onClick={handlePrint}
          >
            {busy === "print" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Imprimir {copiesOk ? copiesNum : ""}
          </Button>
        </div>
        {!copiesOk && copies !== "" && (
          <p className="text-xs text-red-600">La cantidad va de 1 a {MAX_LABEL_COPIES}.</p>
        )}
        {canSave && (
          <Button type="button" variant="secondary" className="w-full" disabled={!!busy || !dirty} onClick={handleSave}>
            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {dirty ? "Guardar formato" : notice || "Formato guardado"}
          </Button>
        )}
        {error && (
          <p className="flex items-start gap-1.5 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </p>
        )}
        <p className="text-xs text-brand-dark/50">
          En la ventana de impresión elegí la impresora de etiquetas, con papel de {LABEL_WIDTH_MM} × {LABEL_HEIGHT_MM} mm y márgenes en &quot;Ninguno&quot;.
        </p>
      </div>
    </div>
  );
}
