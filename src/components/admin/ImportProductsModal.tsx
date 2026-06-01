"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

const TEMPLATE_CSV =
  "nombre,precio_venta,precio_costo,categoria,seccion_menu,descripcion,disponible,destacado,stock,toppings\n" +
  "Café pequeño,1300,300,Café,bebidas,Café negro americano pequeño,true,false,0,\n" +
  "Rollo de canela,800,250,Panadería,panaderia,Rollo con glaseado de azúcar,true,true,10,\n" +
  "Pan de natilla,600,180,Panadería,panaderia,,true,false,15,Natilla|Azúcar";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "productos-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportProductsModal({ onSuccess, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["json", "csv", "xlsx", "xls"].includes(ext ?? "")) {
      setError("Formato no soportado. Usá JSON, CSV o Excel (.xlsx / .xls)");
      return;
    }
    setError("");
    setFile(f);
    setResult(null);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/products/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al importar");
        return;
      }
      setResult(data);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setImporting(false);
    }
  }

  // ── Resultado ────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold text-emerald-700">
              {result.imported} {result.imported === 1 ? "producto importado" : "productos importados"}
            </span>
          </div>
          {result.skipped > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700">
                  {result.skipped} {result.skipped === 1 ? "fila omitida" : "filas omitidas"}
                </p>
                {result.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {result.errors.slice(0, 8).map((e, i) => (
                      <li key={i} className="text-xs text-amber-600">· {e}</li>
                    ))}
                    {result.errors.length > 8 && (
                      <li className="text-xs text-amber-500">... y {result.errors.length - 8} más</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {result.imported > 0 ? (
            <Button className="flex-1" onClick={onSuccess}>Listo</Button>
          ) : (
            <Button className="flex-1" variant="secondary" onClick={onSuccess}>Cerrar</Button>
          )}
          <Button
            variant="secondary"
            onClick={() => { setFile(null); setResult(null); setError(""); }}
          >
            Importar otro archivo
          </Button>
        </div>
      </div>
    );
  }

  // ── Selección de archivo ─────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Descripción + plantilla */}
      <div className="text-sm text-brand-dark/60 space-y-1">
        <p>Subí un archivo con tus productos. Las imágenes se agregan después desde cada producto.</p>
        <p>Formatos aceptados: <span className="font-medium text-brand-dark">JSON, CSV, Excel (.xlsx)</span></p>
      </div>

      <button
        type="button"
        onClick={downloadTemplate}
        className="flex items-center gap-2 text-sm text-brand-pink hover:text-brand-orange font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
        Descargar plantilla CSV
      </button>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileChange(e.dataTransfer.files[0] ?? null); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
          dragging
            ? "border-brand-pink bg-brand-pink/5"
            : file
            ? "border-brand-pink/50 bg-brand-pink/5"
            : "border-brand-muted hover:border-brand-pink/40 hover:bg-brand-pink/5"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <FileText className="w-8 h-8 text-brand-pink" />
            <div className="text-center">
              <p className="text-sm font-semibold text-brand-dark">{file.name}</p>
              <p className="text-xs text-brand-dark/40 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click para cambiar</p>
            </div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-brand-dark/25" />
            <div className="text-center">
              <p className="text-sm text-brand-dark/50">Arrastrá tu archivo aquí o hacé click para seleccionarlo</p>
              <p className="text-xs text-brand-dark/30 mt-1">JSON · CSV · XLSX · XLS</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button
          className="flex-1"
          onClick={handleImport}
          disabled={!file || importing}
        >
          {importing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
          ) : (
            <><Upload className="w-4 h-4" /> Importar</>
          )}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={importing}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
