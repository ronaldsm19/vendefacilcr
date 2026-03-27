"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OrderForm from "@/components/admin/OrderForm";
import Pagination from "@/components/admin/Pagination";
import { IOrder } from "@/models/Order";
import { Plus, CheckCircle, Trash2, Phone, Pencil, Search } from "lucide-react";

function orderProductLabel(o: IOrder): string {
  if (o.items && o.items.length > 0) {
    return o.items.map(i => `${i.productName} ×${i.quantity}`).join(", ");
  }
  return o.productName ? `${o.productName} ×${o.quantity ?? 1}` : "—";
}

function orderToppings(o: IOrder): string[] {
  if (o.items && o.items.length > 0) {
    return o.items.flatMap(i => i.itemToppings?.flat() ?? []);
  }
  return o.options ?? [];
}

type OrderRow = IOrder & { _id: string };

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/orders");
    const d = await r.json();
    setOrders(d.orders ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(data: Record<string, unknown>) {
    if (!editOrder) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${editOrder._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setEditOrder(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(id: string, paid: boolean) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  // ── Stats (always computed from full dataset) ──────────────────
  const paidTotal    = orders.filter((o) => o.paid).reduce((s, o) => s + o.total, 0);
  const pendingTotal = orders.filter((o) => !o.paid).reduce((s, o) => s + o.total, 0);
  const grandTotal   = orders.reduce((s, o) => s + o.total, 0);
  const paidCount    = orders.filter((o) => o.paid).length;
  const pendingCount = orders.filter((o) => !o.paid).length;

  // ── Filtered rows ───────────────────────────────────────────────
  const filteredOrders = orders
    .filter(o =>
      filter === "all"     ? true :
      filter === "paid"    ? o.paid :
                             !o.paid
    )
    .filter(o => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const productLabel = orderProductLabel(o).toLowerCase();
      return (
        o.customerName.toLowerCase().includes(q) ||
        productLabel.includes(q) ||
        o.phone.includes(q)
      );
    });

  const totalPages   = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage     = Math.min(page, totalPages);
  const displayOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Pedidos</h1>
          <p className="text-brand-dark/50 text-sm mt-1">
            {paidCount} pagados · {pendingCount} pendientes
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nuevo pedido
        </Button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {(["all", "pending", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
                filter === f
                  ? "gradient-bg text-white border-transparent"
                  : "bg-white text-brand-dark/60 border-brand-muted hover:border-brand-pink/30"
              }`}
            >
              {f === "all" ? "Todos" : f === "paid" ? "Pagados" : "Pendientes"}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-dark/30" />
          <input
            type="text"
            placeholder="Buscar cliente o producto..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 pr-3 py-1.5 border border-brand-muted rounded-full text-sm focus:outline-none focus:border-brand-pink w-full sm:w-64"
          />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="flex flex-wrap gap-3">
        {(filter === "all" || filter === "paid") && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="text-emerald-500 text-lg">✅</span>
            <div>
              <p className="text-xs text-emerald-600/70 font-medium">
                {filter === "all" ? "Total pagado" : "Pagados"}
              </p>
              <p className="text-base font-bold text-emerald-700">
                ₡{paidTotal.toLocaleString("es-CR")}
              </p>
            </div>
          </div>
        )}
        {(filter === "all" || filter === "pending") && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100">
            <span className="text-orange-400 text-lg">⏳</span>
            <div>
              <p className="text-xs text-orange-500/80 font-medium">
                {filter === "all" ? "Por cobrar" : "Pendientes"}
              </p>
              <p className="text-base font-bold text-orange-600">
                ₡{pendingTotal.toLocaleString("es-CR")}
              </p>
            </div>
          </div>
        )}
        {filter === "all" && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-muted border border-brand-pink/10">
            <span className="text-brand-pink text-lg">📊</span>
            <div>
              <p className="text-xs text-brand-dark/50 font-medium">Total general</p>
              <p className="text-base font-bold text-brand-dark">
                ₡{grandTotal.toLocaleString("es-CR")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Producto</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Opciones</th>
                <th className="text-left px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.map((o) => (
                <tr key={o._id} className="border-b border-brand-muted/50 hover:bg-brand-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-dark">{o.customerName}</p>
                    <a
                      href={`https://wa.me/${o.phone.replace(/\D/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#25D366] hover:underline"
                    >
                      <Phone className="w-3 h-3" /> {o.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-brand-dark/70 max-w-[180px]">
                    <p className="truncate text-sm" title={orderProductLabel(o)}>{orderProductLabel(o)}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {(() => {
                      const tops = orderToppings(o);
                      return (
                        <div className="flex flex-wrap gap-1">
                          {tops.slice(0, 2).map((op) => (
                            <span key={op} className="text-xs px-2 py-0.5 rounded-full bg-brand-muted text-brand-dark/60">{op}</span>
                          ))}
                          {tops.length > 2 && (
                            <span className="text-xs text-brand-dark/40">+{tops.length - 2}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-dark">
                    ₡{o.total.toLocaleString("es-CR")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.paid ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"
                    }`}>
                      {o.paid ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {!o.paid && (
                        <button
                          onClick={() => togglePaid(o._id, true)}
                          title="Marcar como pagado"
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-brand-dark/40 hover:text-emerald-600 transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditOrder(o)}
                        title="Editar pedido"
                        className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/40 hover:text-brand-pink transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(o._id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/40 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-dark/40">
                    {search ? "Sin resultados para esa búsqueda." : filter !== "all" ? "No hay pedidos con este filtro." : "No hay pedidos registrados aún."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={s => { setPageSize(s); setPage(1); }}
            totalItems={filteredOrders.length}
          />
        </div>
      )}

      {/* New Order Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4">
            <DialogTitle>Registrar pedido</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <OrderForm onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={!!editOrder} onOpenChange={(v) => !v && setEditOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4">
            <DialogTitle>Editar pedido</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {editOrder && (
              <OrderForm
                key={editOrder._id}
                initial={{
                  customerName: editOrder.customerName,
                  phone:        editOrder.phone,
                  items:        editOrder.items,
                  // Legacy fallback para órdenes antiguas
                  productId:    editOrder.productId as unknown as string | undefined,
                  productName:  editOrder.productName,
                  quantity:     editOrder.quantity,
                  total:        editOrder.total,
                  paid:         editOrder.paid,
                  orderedAt:    editOrder.orderedAt,
                  notes:        editOrder.notes,
                  options:      editOrder.options,
                }}
                onSave={handleEditSave}
                onCancel={() => setEditOrder(null)}
                saving={saving}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2"><DialogTitle>¿Eliminar pedido?</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-brand-dark/60">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 bg-red-50 text-red-600 hover:bg-red-100"
                onClick={() => confirmDelete && handleDelete(confirmDelete)}>Eliminar</Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
