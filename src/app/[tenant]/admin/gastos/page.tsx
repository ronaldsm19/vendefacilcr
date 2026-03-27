"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExpenseForm from "@/components/admin/ExpenseForm";
import { IExpense } from "@/models/Expense";
import { Plus, Trash2, ExternalLink, ChevronDown } from "lucide-react";

type ExpenseRow = IExpense & { _id: string };

const catLabel: Record<string, string> = {
  materia_prima: "Materia prima",
  empaque:       "Empaque",
  herramientas:  "Herramientas",
  marketing:     "Marketing",
  otros:         "Otros",
};

const catColor: Record<string, string> = {
  materia_prima: "bg-blue-50 text-blue-600",
  empaque:       "bg-purple-50 text-purple-600",
  herramientas:  "bg-orange-50 text-orange-600",
  marketing:     "bg-pink-50 text-pink-600",
  otros:         "bg-gray-50 text-gray-600",
};

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/expenses");
    const d = await r.json();
    setExpenses(d.expenses ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch("/api/admin/expenses", {
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

  async function handleDelete(id: string) {
    await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  const totalGastos = expenses.reduce((s, e) => s + e.total, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Gastos / Facturas</h1>
          <p className="text-brand-dark/50 text-sm mt-1">
            {expenses.length} facturas · Total: ₡{totalGastos.toLocaleString("es-CR")}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nueva factura
        </Button>
      </div>

      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : (
        <div className="space-y-3">
          {expenses.map((e) => (
            <div key={e._id} className="bg-white rounded-2xl card-shadow overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-brand-muted/20 transition-colors"
                onClick={() => setExpanded(expanded === e._id ? null : e._id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-brand-dark">{e.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${catColor[e.category] ?? catColor.otros}`}>
                      {catLabel[e.category] ?? e.category}
                    </span>
                  </div>
                  <p className="text-xs text-brand-dark/40 mt-0.5">
                    {new Date(e.date).toLocaleDateString("es-CR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" })}
                    · {e.items.length} item{e.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="font-bold text-brand-dark shrink-0">
                  ₡{e.total.toLocaleString("es-CR")}
                </span>
                {e.receiptImage && (
                  <a href={e.receiptImage} target="_blank" rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-brand-pink hover:text-brand-orange transition-colors"
                    title="Ver recibo">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={(ev) => { ev.stopPropagation(); setConfirmDelete(e._id); }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/30 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronDown className={`w-4 h-4 text-brand-dark/30 transition-transform ${expanded === e._id ? "rotate-180" : ""}`} />
              </div>

              {/* Expanded items */}
              {expanded === e._id && (
                <div className="border-t border-brand-muted px-5 py-4 bg-brand-muted/20">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-brand-dark/40 uppercase">
                        <th className="text-left pb-2">Descripción</th>
                        <th className="text-right pb-2">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.items.map((item, i) => (
                        <tr key={i} className="border-t border-brand-muted/60">
                          <td className="py-1.5 text-brand-dark/70">{item.description}</td>
                          <td className="py-1.5 text-right font-medium text-brand-dark">
                            ₡{item.amount.toLocaleString("es-CR")}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-brand-pink/20">
                        <td className="pt-2 font-semibold text-brand-dark">Total</td>
                        <td className="pt-2 text-right font-bold gradient-text">
                          ₡{e.total.toLocaleString("es-CR")}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {e.notes && (
                    <p className="mt-3 text-xs text-brand-dark/50 italic">{e.notes}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {expenses.length === 0 && (
            <div className="bg-white rounded-2xl card-shadow p-8 text-center text-brand-dark/40">
              No hay facturas registradas aún.
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4"><DialogTitle>Nueva factura / gasto</DialogTitle></DialogHeader>
          <div className="px-6 pb-6">
            <ExpenseForm onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2"><DialogTitle>¿Eliminar factura?</DialogTitle></DialogHeader>
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
