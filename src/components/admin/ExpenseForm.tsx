"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Upload, ImageIcon, Loader2, X, ScanLine } from "lucide-react";
import { ExpenseCategory } from "@/models/Expense";

interface ExpenseItem { description: string; amount: string; }

interface ExpenseFormProps {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

const categories: { value: ExpenseCategory; label: string }[] = [
  { value: "materia_prima", label: "Materia prima" },
  { value: "empaque",       label: "Empaque" },
  { value: "herramientas",  label: "Herramientas" },
  { value: "marketing",     label: "Marketing" },
  { value: "otros",         label: "Otros" },
];

export default function ExpenseForm({ onSave, onCancel, saving }: ExpenseFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("materia_prima");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ExpenseItem[]>([{ description: "", amount: "" }]);
  const [receiptImage, setReceiptImage] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload?folder=billing", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Error al subir la imagen");
        return;
      }
      setReceiptImage(data.url);
    } catch {
      setUploadError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError("");
    setScanning(true);

    try {
      // Run upload and AI parse in parallel
      const uploadForm = new FormData();
      uploadForm.append("file", file);

      const parseForm = new FormData();
      parseForm.append("file", file);

      const [uploadRes, parseRes] = await Promise.all([
        fetch("/api/admin/upload?folder=billing", { method: "POST", body: uploadForm }),
        fetch("/api/admin/parse-receipt",          { method: "POST", body: parseForm }),
      ]);

      const [uploadData, parseData] = await Promise.all([
        uploadRes.json(),
        parseRes.json(),
      ]);

      if (uploadRes.ok && uploadData.url) {
        setReceiptImage(uploadData.url);
      }

      if (!parseRes.ok || !parseData.data) {
        setScanError(parseData.error ?? "No se pudo analizar la factura");
        return;
      }

      const d = parseData.data;
      if (d.title)    setTitle(d.title);
      if (d.date)     setDate(d.date);
      if (d.category) setCategory(d.category as ExpenseCategory);
      if (d.notes)    setNotes(d.notes);
      if (Array.isArray(d.items) && d.items.length > 0) {
        setItems(d.items.map((it: { description: string; amount: number }) => ({
          description: it.description,
          amount:      String(it.amount),
        })));
      }
    } catch {
      setScanError("Error de conexión al analizar la imagen");
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  }

  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  function addItem() {
    setItems((prev) => [...prev, { description: "", amount: "" }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ExpenseItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter((i) => i.description && Number(i.amount) > 0);
    if (!validItems.length) return;
    await onSave({
      title, category, date,
      items: validItems.map((i) => ({ description: i.description, amount: Number(i.amount) })),
      receiptImage: receiptImage || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── Escanear con IA ── */}
      <div>
        <button
          type="button"
          onClick={() => scanInputRef.current?.click()}
          disabled={scanning}
          className="w-full border-2 border-dashed border-brand-pink/40 hover:border-brand-pink rounded-xl py-4 flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-brand-pink/5 hover:bg-brand-pink/10"
        >
          {scanning ? (
            <>
              <Loader2 className="w-5 h-5 text-brand-pink animate-spin" />
              <span className="text-sm font-semibold text-brand-pink">Analizando factura con IA...</span>
            </>
          ) : (
            <>
              <ScanLine className="w-5 h-5 text-brand-pink" />
              <span className="text-sm font-semibold text-brand-pink">Escanear factura con IA</span>
              <span className="text-xs text-brand-dark/40 font-normal">· llena el formulario automáticamente</span>
            </>
          )}
        </button>
        <input
          ref={scanInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleScanFile}
        />
        {scanError && (
          <p className="mt-1.5 text-xs text-red-500">{scanError}</p>
        )}
      </div>

      {/* Título */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Título de la factura *</label>
        <input
          type="text" required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Compra materia prima - 24 marzo"
          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
        />
      </div>

      {/* Categoría + Fecha */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Categoría</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-brand-dark">Items de la factura *</label>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                placeholder="Descripción del item"
                className="flex-1 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
              <input
                type="number" min={0}
                value={item.amount}
                onChange={(e) => updateItem(idx, "amount", e.target.value)}
                placeholder="₡ Monto"
                className="w-28 border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Total calculado */}
        <div className="mt-3 flex justify-end">
          <span className="text-sm font-semibold text-brand-dark">
            Total: <span className="gradient-text text-base">₡{total.toLocaleString("es-CR")}</span>
          </span>
        </div>
      </div>

      {/* Foto del recibo */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-2">
          Foto del recibo (opcional)
        </label>

        {receiptImage ? (
          <div className="relative rounded-xl overflow-hidden border border-brand-muted bg-brand-muted/30">
            <div className="relative w-full h-36">
              <Image
                src={receiptImage}
                alt="Recibo"
                fill
                className="object-cover"
                sizes="400px"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-brand-dark hover:bg-brand-muted transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => { setReceiptImage(""); setUploadError(""); }}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Quitar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-brand-muted hover:border-brand-pink/50 rounded-xl py-6 flex flex-col items-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-brand-muted/20 hover:bg-brand-pink/5"
          >
            {uploading ? (
              <>
                <Loader2 className="w-6 h-6 text-brand-pink animate-spin" />
                <span className="text-sm text-brand-dark/50">Subiendo imagen...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-6 h-6 text-brand-dark/30" />
                <span className="text-sm font-medium text-brand-dark/60">
                  Haz click para subir la foto del recibo
                </span>
                <span className="text-xs text-brand-dark/40">JPG, PNG, WEBP · Máx. 5 MB</span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploadError && (
          <p className="mt-1.5 text-xs text-red-500">{uploadError}</p>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Notas</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Guardando..." : "Guardar factura"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
