"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOpeningDialogProps {
  /** Lo que quedó en el último cierre: es la caja inicial de esta apertura. */
  previousCashLeft: number;
  countedAmount: number;
  opening: boolean;
  onCorrect: () => void;
  onConfirm: () => void;
}

function fmt(n: number) {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 0 })}`;
}

/**
 * Se muestra al abrir la caja cuando lo contado no coincide con lo que quedó en el último cierre.
 * Frena el caso más común: abrir con el campo en 0 o con un dígito de más o de menos.
 */
export default function ConfirmOpeningDialog({
  previousCashLeft, countedAmount, opening, onCorrect, onConfirm,
}: ConfirmOpeningDialogProps) {
  const difference = countedAmount - previousCashLeft;

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !opening) onCorrect(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿El conteo está bien?</DialogTitle>
          <DialogDescription>
            Lo que contaste no coincide con lo que quedó en el último cierre.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-brand-dark/60">Quedó en el último cierre</span>
              <span className="font-semibold tabular-nums">{fmt(previousCashLeft)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-brand-dark/60">Contaste ahora</span>
              <span className="font-semibold tabular-nums">{fmt(countedAmount)}</span>
            </div>
            <div className={`flex justify-between gap-3 font-semibold pt-1.5 border-t border-gray-200 ${
              difference < 0 ? "text-red-600" : "text-amber-600"
            }`}>
              <span>{difference < 0 ? "Faltan" : "Sobran"}</span>
              <span className="tabular-nums">{fmt(Math.abs(difference))}</span>
            </div>
          </div>
          <p className="text-sm text-brand-dark/70">
            Si contaste bien, abrí la caja y la diferencia queda registrada. Si te equivocaste al escribir, corregí el monto.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={onCorrect} disabled={opening}>
            Corregir monto
          </Button>
          <Button type="button" onClick={onConfirm} disabled={opening}>
            {opening ? "Abriendo..." : "Sí, abrir caja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
