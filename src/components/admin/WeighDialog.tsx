"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC } from "@/lib/billing";
import { kgInputText, readScaleKg, type ScaleResult } from "@/lib/scale";
import { parseKg, priceForWeight, weightDetail } from "@/lib/soldBy";

export interface WeighProduct {
  _id: string;
  name: string;
  /** Precio del kilo. */
  price: number;
}

/**
 * Pesar una pieza de un producto por kilo (caja y comandas): el peso se escribe a mano o se lee de
 * la báscula del agente, y se ve el precio de la pieza antes de agregarla. Al abrirse intenta leer
 * la báscula una vez, por si el producto ya está encima.
 */
export default function WeighDialog({
  product,
  onClose,
  onConfirm,
  confirmLabel = "Agregar",
}: {
  product: WeighProduct | null;
  onClose: () => void;
  onConfirm: (weightKg: number) => void;
  confirmLabel?: string;
}) {
  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        {product && <WeighBody key={product._id} product={product} onClose={onClose} onConfirm={onConfirm} confirmLabel={confirmLabel} />}
      </DialogContent>
    </Dialog>
  );
}

function WeighBody({
  product, onClose, onConfirm, confirmLabel,
}: {
  product: WeighProduct;
  onClose: () => void;
  onConfirm: (weightKg: number) => void;
  confirmLabel: string;
}) {
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState<ScaleResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const touched = useRef(false);

  const kg = text.trim() ? parseKg(text) : null;
  const invalid = text.trim() !== "" && kg === null;

  async function read() {
    setReading(true);
    const r = await readScaleKg();
    setReading(false);
    if (r.kg) setText(kgInputText(r.kg));
    setMsg(r);
    inputRef.current?.focus();
  }

  // Al abrir se lee la báscula una vez, por si el producto ya está encima. Esa lectura no pisa lo
  // que ya se escribió ni muestra errores (sin agente o sin báscula, simplemente se escribe a mano).
  useEffect(() => {
    let alive = true;
    readScaleKg().then((r) => {
      if (!alive || !r.kg || r.tone !== "ok" || touched.current) return;
      setText(kgInputText(r.kg));
      setMsg(r);
    });
    return () => { alive = false; };
  }, []);

  function confirm() {
    if (kg !== null) onConfirm(kg);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base">{product.name}</DialogTitle>
      </DialogHeader>
      <div className="px-6 pb-6 pt-2 space-y-4">
        <p className="text-brand-pink font-bold text-lg">{formatCRC(product.price)}/kg</p>
        <div>
          <label htmlFor="weigh-kg" className="block text-sm font-medium text-brand-dark mb-1">Peso (kg)</label>
          <div className="flex gap-2">
            <input
              id="weigh-kg"
              ref={inputRef}
              autoFocus
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,350"
              value={text}
              onChange={(e) => { touched.current = true; setText(e.target.value); setMsg(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-base font-mono focus:outline-none focus:border-brand-pink"
            />
            <Button type="button" variant="secondary" onClick={() => read()} disabled={reading} className="shrink-0">
              {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />} Báscula
            </Button>
          </div>
          {invalid && <p className="text-xs text-red-600 mt-1">Escribí el peso en kilos, p. ej. 0,350</p>}
          {msg && (
            <p className={`text-xs mt-1 ${msg.tone === "ok" ? "text-emerald-700" : msg.tone === "warn" ? "text-amber-700" : "text-red-600"}`}>{msg.text}</p>
          )}
        </div>
        <div className="rounded-xl bg-brand-muted/40 px-3 py-2 text-sm">
          {kg !== null ? (
            <>
              <p className="text-brand-dark/60">{weightDetail(kg, product.price)}</p>
              <p className="text-lg font-bold text-brand-dark">{formatCRC(priceForWeight(product.price, kg))}</p>
            </>
          ) : (
            <p className="text-brand-dark/50">Poné el producto en la báscula y tocá &quot;Báscula&quot;, o escribí el peso.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="button" className="flex-1" disabled={kg === null} onClick={confirm}>{confirmLabel}</Button>
        </div>
      </div>
    </>
  );
}
