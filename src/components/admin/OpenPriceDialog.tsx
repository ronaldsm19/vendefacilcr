"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC } from "@/lib/billing";
import { MAX_OPEN_PRICE, parseOpenPrice } from "@/lib/soldBy";

export interface OpenPriceProduct {
  _id: string;
  name: string;
  /** Precio sugerido (0 = sin sugerido). */
  price: number;
}

/**
 * Precio de una pieza de un producto de precio libre (pulseras, artesanías): el cajero o el mesero
 * escribe cuánto cuesta esta pieza antes de agregarla. Si el producto tiene precio sugerido, aparece
 * ya escrito. Cada pieza entra como una línea aparte, con su precio.
 */
export default function OpenPriceDialog({
  product,
  onClose,
  onConfirm,
  confirmLabel = "Agregar",
}: {
  product: OpenPriceProduct | null;
  onClose: () => void;
  onConfirm: (unitPrice: number) => void;
  confirmLabel?: string;
}) {
  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        {product && <OpenPriceBody key={product._id} product={product} onClose={onClose} onConfirm={onConfirm} confirmLabel={confirmLabel} />}
      </DialogContent>
    </Dialog>
  );
}

function OpenPriceBody({
  product, onClose, onConfirm, confirmLabel,
}: {
  product: OpenPriceProduct;
  onClose: () => void;
  onConfirm: (unitPrice: number) => void;
  confirmLabel: string;
}) {
  const [text, setText] = useState(product.price > 0 ? String(product.price) : "");
  const price = text.trim() ? parseOpenPrice(text) : null;
  const invalid = text.trim() !== "" && price === null;

  function confirm() {
    if (price !== null) onConfirm(price);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base">{product.name}</DialogTitle>
      </DialogHeader>
      <div className="px-6 pb-6 pt-2 space-y-4">
        <p className="text-sm text-brand-dark/60">Precio libre: escribí cuánto cuesta esta pieza.</p>
        <div>
          <label htmlFor="open-price" className="block text-sm font-medium text-brand-dark mb-1">Precio (₡)</label>
          <input
            id="open-price"
            autoFocus
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="4500"
            value={text}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
            className="w-full border border-brand-muted rounded-xl px-3 py-2 text-lg font-mono focus:outline-none focus:border-brand-pink"
          />
          {invalid && (
            <p className="text-xs text-red-600 mt-1">Escribí un monto en colones, mayor que cero y hasta {formatCRC(MAX_OPEN_PRICE)}.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="button" className="flex-1" disabled={price === null} onClick={confirm}>
            {price !== null ? `${confirmLabel} ${formatCRC(price)}` : confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
