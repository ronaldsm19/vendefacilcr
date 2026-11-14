"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus, Search, X } from "lucide-react";
import CustomerFormDialog from "@/components/admin/CustomerFormDialog";
import { ID_TYPE_LABELS, formatIdNumber, normalizeIdNumber, type CustomerView } from "@/lib/customerId";

/**
 * "Factura a nombre de…" en el cobro. Se busca al cliente por cédula o nombre; si es nuevo, se
 * registra ahí mismo (con la consulta a Hacienda) sin salir de la venta. Al cobrar, el comprobante
 * le llega por correo.
 */

interface Props {
  value: CustomerView | null;
  onChange: (customer: CustomerView | null) => void;
  disabled?: boolean;
}

const MAX_RESULTS = 5;

export default function InvoiceCustomerPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerView[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState(false);
  const requestId = useRef(0);

  // Búsqueda en vivo, con una pausa corta para no consultar en cada tecla. Sin texto se muestran
  // los clientes con factura más reciente, que suelen ser los de siempre.
  useEffect(() => {
    if (!open || value) return;
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ pageSize: "15" });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/admin/invoice-customers?${params}`);
        const data = await res.json();
        if (id !== requestId.current) return;
        if (!res.ok) { setError(data.error ?? "No se pudo buscar"); setResults([]); return; }
        setError("");
        setResults((data.customers ?? []).slice(0, MAX_RESULTS));
      } catch {
        if (id === requestId.current) setError("No se pudo buscar. Revisá la conexión.");
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, open, value]);

  function start() {
    setOpen(true);
    setQuery("");
  }

  function pick(c: CustomerView) {
    onChange(c);
    setOpen(false);
    setRegistering(false);
  }

  function clear() {
    onChange(null);
    setOpen(false);
    setQuery("");
  }

  const digits = normalizeIdNumber(query);
  const looksLikeId = !/[a-zA-ZÀ-ÿ@]/.test(query) && digits.length >= 9;

  if (value) {
    return (
      <div className="rounded-xl border border-brand-pink/30 bg-brand-pink/5 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-brand-pink mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-brand-dark/50">Factura a nombre de</p>
            <p className="text-sm font-semibold text-brand-dark truncate">{value.name}</p>
            <p className="text-xs text-brand-dark/50 truncate">
              {ID_TYPE_LABELS[value.idType]} {formatIdNumber(value.idType, value.idNumber)} · {value.email}
            </p>
          </div>
          <button
            type="button" onClick={clear} disabled={disabled} aria-label="Quitar cliente de la factura"
            className="p-1 rounded-lg text-brand-dark/40 hover:text-brand-dark hover:bg-white cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button" onClick={start} disabled={disabled}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-muted py-2.5 text-sm font-medium text-brand-dark/60 hover:border-brand-pink hover:text-brand-pink transition-colors cursor-pointer disabled:opacity-40"
      >
        <FileText className="w-4 h-4" /> Factura a nombre de…
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-brand-muted p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-brand-dark/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Cédula o nombre"
            className="w-full border border-brand-muted rounded-lg pl-8 pr-2 py-2 text-sm focus:outline-none focus:border-brand-pink"
          />
        </div>
        <button
          type="button" onClick={() => setOpen(false)} aria-label="Cerrar búsqueda de cliente"
          className="p-1.5 rounded-lg text-brand-dark/40 hover:text-brand-dark cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="max-h-48 overflow-y-auto -mx-1">
        {searching && results.length === 0 ? (
          <p className="flex items-center gap-1.5 px-1 py-2 text-xs text-brand-dark/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…
          </p>
        ) : results.length === 0 ? (
          <p className="px-1 py-2 text-xs text-brand-dark/40">
            {query.trim() ? "Ningún cliente coincide." : "Todavía no hay clientes registrados."}
          </p>
        ) : (
          results.map((c) => (
            <button
              key={c._id} type="button" onClick={() => pick(c)}
              className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-brand-muted/60 cursor-pointer"
            >
              <p className="text-sm font-medium text-brand-dark truncate">{c.name}</p>
              <p className="text-xs text-brand-dark/50 truncate">
                {formatIdNumber(c.idType, c.idNumber)} · {c.email}
              </p>
            </button>
          ))
        )}
      </div>

      <button
        type="button" onClick={() => setRegistering(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand-muted/60 py-2 text-xs font-semibold text-brand-dark hover:bg-brand-pink/10 hover:text-brand-pink cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        {looksLikeId ? `Registrar ${digits}` : "Registrar cliente nuevo"}
      </button>

      <CustomerFormDialog
        open={registering}
        initialIdNumber={looksLikeId ? digits : ""}
        onClose={() => setRegistering(false)}
        onSaved={pick}
      />
    </div>
  );
}
