"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminSession } from "@/components/admin/SessionContext";
import CustomerFormDialog from "@/components/admin/CustomerFormDialog";
import Pagination from "@/components/admin/Pagination";
import { ID_TYPE_LABELS, formatIdNumber, type CustomerView } from "@/lib/customerId";

function lastInvoiceLabel(c: CustomerView): string {
  if (!c.lastInvoiceAt) return "—";
  return new Date(c.lastInvoiceAt).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ClientesPage() {
  const { role } = useAdminSession();
  const isAdmin = role === "admin";

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerView | null>(null);
  const [toDelete, setToDelete] = useState<CustomerView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // La búsqueda espera a que la caja deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debounced) params.set("q", debounced);
      const res = await fetch(`/api/admin/invoice-customers?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error ?? "No se pudieron cargar los clientes");
        setCustomers([]);
        setTotal(0);
        return;
      }
      setLoadError("");
      setCustomers(data.customers ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setLoadError("No se pudieron cargar los clientes. Revisá la conexión.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debounced]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(c: CustomerView) {
    setEditing(c);
    setFormOpen(true);
  }

  function onSaved(c: CustomerView) {
    setFormOpen(false);
    setEditing(null);
    // Si era un alta (o "Usar este cliente"), se deja a la vista buscándolo por su cédula.
    if (!editing) setQuery(c.idNumber);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/admin/invoice-customers/${toDelete._id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "No se pudo eliminar");
        return;
      }
      setToDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  const searching = debounced.length > 0;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Clientes</h1>
          <p className="text-brand-dark/50 text-sm mt-1">
            Los que piden factura. Registralos una vez y la próxima los buscás por cédula o por nombre.
          </p>
        </div>
        <Button className="shrink-0" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-brand-dark/30 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cédula, nombre o correo"
          className="w-full bg-white border border-brand-muted rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
        />
        {query && (
          <button
            type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-brand-dark/40 hover:text-brand-dark cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">{loadError}</div>
      )}

      {loading && customers.length === 0 ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : !loadError && customers.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-8 text-center text-brand-dark/40 text-sm space-y-3">
          {searching ? (
            <>
              <p>Ningún cliente coincide con “{debounced}”.</p>
              <Button variant="secondary" size="sm" onClick={openCreate}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Registrar cliente nuevo
              </Button>
            </>
          ) : (
            <p>Todavía no hay clientes. Cuando alguien te pida factura, registralo con Nuevo cliente.</p>
          )}
        </div>
      ) : !loadError && (
        <>
          {/* Desktop */}
          <div className={`hidden md:block bg-white rounded-2xl card-shadow overflow-hidden ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-dark/40 uppercase border-b border-brand-muted">
                  <th className="text-left px-5 py-3">Cliente</th>
                  <th className="text-left px-5 py-3">Identificación</th>
                  <th className="text-left px-5 py-3">Correo</th>
                  <th className="text-left px-5 py-3">Última factura</th>
                  <th className="text-right px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} className="border-b border-brand-muted/60 last:border-0 align-top">
                    <td className="px-5 py-3">
                      <p className="font-medium text-brand-dark">{c.name}</p>
                      {c.activityName && <p className="text-xs text-brand-dark/40 mt-0.5 line-clamp-1">{c.activityName}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-brand-dark">{formatIdNumber(c.idType, c.idNumber)}</p>
                      <p className="text-xs text-brand-dark/40 mt-0.5">{ID_TYPE_LABELS[c.idType]}</p>
                    </td>
                    <td className="px-5 py-3 text-brand-dark/70 break-all">{c.email}</td>
                    <td className="px-5 py-3 text-brand-dark/60">
                      {lastInvoiceLabel(c)}
                      {c.invoiceCount > 0 && <span className="text-xs text-brand-dark/40"> · {c.invoiceCount}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Editar" aria-label={`Editar ${c.name}`} onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/50 hover:text-brand-dark transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <Button size="icon-sm" variant="destructive" title="Eliminar" aria-label={`Eliminar ${c.name}`} onClick={() => { setDeleteError(""); setToDelete(c); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className={`md:hidden space-y-3 ${loading ? "opacity-60" : ""}`}>
            {customers.map((c) => (
              <div key={c._id} className="bg-white rounded-2xl card-shadow p-4 space-y-2">
                <div className="min-w-0">
                  <p className="font-medium text-brand-dark">{c.name}</p>
                  <p className="text-xs text-brand-dark/50">
                    {ID_TYPE_LABELS[c.idType]} <span className="font-mono">{formatIdNumber(c.idType, c.idNumber)}</span>
                  </p>
                </div>
                <p className="text-sm text-brand-dark/70 break-all">{c.email}</p>
                <p className="text-xs text-brand-dark/40">Última factura: {lastInvoiceLabel(c)}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(c)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  {isAdmin && (
                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => { setDeleteError(""); setToDelete(c); }}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={(s) => { setPageSize(s); setPage(1); }}
            totalItems={total}
          />
        </>
      )}

      <CustomerFormDialog
        open={formOpen}
        customer={editing}
        initialIdNumber={!editing && /^[\d\s-]+$/.test(query) ? query : ""}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={onSaved}
      />

      {/* Eliminar cliente */}
      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2"><DialogTitle>¿Eliminar cliente?</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-brand-dark/60">
              {toDelete?.name} sale del registro. Las facturas que ya se le mandaron conservan sus datos.
              Esta acción no se puede deshacer.
            </p>
            {deleteError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{deleteError}</p>}
            <div className="flex gap-3">
              <Button variant="destructive" className="flex-1" disabled={deleting} onClick={confirmDelete}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
              </Button>
              <Button variant="cancel" className="flex-1" onClick={() => setToDelete(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
