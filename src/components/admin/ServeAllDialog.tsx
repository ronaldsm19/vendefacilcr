"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ComandaRow } from "@/components/admin/ComandaCard";

interface ServeAllDialogProps {
  tableId: string;
  /** Comandas con status "enviada" en esta mesa — las que se marcarían servidas. */
  pending: ComandaRow[];
  onClose: () => void;
  onDone: () => void;
}

export default function ServeAllDialog({ tableId, pending, onClose, onDone }: ServeAllDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/comandas/serve-by-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo marcar servidas");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>¿Ya se sirvieron estas comandas?</DialogTitle></DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          <p className="text-sm text-brand-dark/60">
            Revisalas una por una antes de confirmar — esto las marca todas como servidas de una vez.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pending.map((c) => (
              <div key={c._id} className="rounded-xl border border-brand-muted px-3 py-2">
                <p className="text-sm font-semibold text-brand-dark">#{c.number} · {c.waiterName}</p>
                <p className="text-xs text-brand-dark/50">
                  {c.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                </p>
              </div>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <Button className="flex-1" disabled={saving} onClick={handleConfirm}>
              {saving ? "Confirmando..." : "Sí, ya se sirvieron"}
            </Button>
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
