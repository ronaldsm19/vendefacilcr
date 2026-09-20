"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ComandaRow } from "@/components/admin/ComandaCard";

interface CancelComandaDialogProps {
  comanda: ComandaRow;
  onClose: () => void;
  onDone: (comanda: ComandaRow, table: unknown) => void;
}

export default function CancelComandaDialog({ comanda, onClose, onDone }: CancelComandaDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/comandas/${comanda._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo anular la comanda");
        return;
      }
      onDone(data.comanda, data.table);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>¿Anular comanda #{comanda.number}?</DialogTitle></DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          <p className="text-sm text-brand-dark/60">No se imprime nada y no se cobra. Esta acción no se puede deshacer.</p>
          <textarea
            placeholder="Razón (opcional)"
            maxLength={200}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink resize-none"
          />
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1 bg-red-50 text-red-600 hover:bg-red-100" disabled={saving} onClick={handleCancel}>
              Anular
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>Volver</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
