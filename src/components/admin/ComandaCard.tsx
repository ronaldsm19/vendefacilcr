"use client";

import { Button } from "@/components/ui/button";
import { weighedName } from "@/lib/soldBy";
import { CheckCheck, Ban, Pencil, Eye, ArrowRightLeft } from "lucide-react";
import type { IComanda } from "@/models/Comanda";
import { comandaMinutes, badgeLevel, BADGE_COLORS, type ComandaThresholds } from "@/lib/comandaTime";
import { extraLabel, extraQty } from "@/lib/pricing";

export type ComandaRow = Omit<IComanda, "sentAt" | "servedAt" | "paidAt" | "cancelledAt" | "createdAt" | "updatedAt"> & {
  sentAt: string;
  servedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_PILL: Record<ComandaRow["status"], string> = {
  enviada: "bg-blue-50 text-blue-700",
  servida: "bg-emerald-50 text-emerald-700",
  pagada: "bg-brand-muted text-brand-dark/60",
  anulada: "bg-red-50 text-red-600",
};
const STATUS_LABEL: Record<ComandaRow["status"], string> = {
  enviada: "Enviada", servida: "Servida", pagada: "Pagada", anulada: "Anulada",
};

interface ComandaCardProps {
  comanda: ComandaRow;
  thresholds: ComandaThresholds;
  now: Date;
  onServe?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onOpen?: () => void;
  /** Cambiar la comanda de mesa (la gente se pasó a otra). */
  onMove?: () => void;
  compact?: boolean;
}

export default function ComandaCard({ comanda, thresholds, now, onServe, onCancel, onEdit, onOpen, onMove, compact }: ComandaCardProps) {
  const isOpen = comanda.status === "enviada" || comanda.status === "servida";
  const hasPaidItems = comanda.items.some((i) => i.paidQty > 0);
  const minutes = comandaMinutes(comanda, now);
  const level = minutes !== null ? badgeLevel(minutes, thresholds) : null;

  return (
    <div className="bg-white rounded-2xl card-shadow p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-brand-dark">#{comanda.number}</span>
          {comanda.version > 1 && <span className="text-xs text-brand-dark/40">v{comanda.version}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[comanda.status]}`}>
            {STATUS_LABEL[comanda.status]}
          </span>
          {minutes !== null && level && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: BADGE_COLORS[level].bg, color: BADGE_COLORS[level].text }}
            >
              {minutes}′
            </span>
          )}
        </div>
        <span className="text-xs text-brand-dark/40 shrink-0">
          {new Date(comanda.sentAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <p className="text-sm text-brand-dark/70">
        {comanda.areaName ? `${comanda.areaName} · ` : ""}Mesa {comanda.tableLabel} · {comanda.waiterName}
        {comanda.customerName && ` · ${comanda.customerName}`}
      </p>

      {!compact && (
        <div className="space-y-1 pt-1">
          {comanda.items.map((item, i) => (
            <div key={i} className="text-sm">
              <span className={item.paidQty >= item.quantity ? "text-brand-dark/40" : "text-brand-dark"}>
                {item.quantity} × {weighedName(item.productName, item.weightKg)}
              </span>
              {item.paidQty > 0 && (
                <span className="ml-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5">
                  {item.paidQty >= item.quantity ? "Pagado" : `Pagado ${item.paidQty} de ${item.quantity}`}
                </span>
              )}
              {item.extras?.map((e) => (
                <p key={e.name} className="text-xs text-brand-dark/60 pl-4">
                  + {extraLabel(e)} <span className="text-brand-dark/40">₡{(e.price * extraQty(e)).toLocaleString("es-CR")}</span>
                </p>
              ))}
              {item.note && <p className="text-xs text-brand-dark/60 pl-4">{item.note}</p>}
            </div>
          ))}
        </div>
      )}

      {!compact && comanda.notes && (
        <p className="text-xs text-brand-dark/60 italic pt-1">{comanda.notes}</p>
      )}

      {!compact && comanda.status === "anulada" && comanda.cancelReason && (
        <p className="text-xs text-red-500">Razón: {comanda.cancelReason}</p>
      )}

      {(onServe || onCancel || onEdit || onOpen || onMove) && (
        <div className="flex flex-wrap gap-2 pt-2">
          {onOpen && (
            <Button size="sm" variant="secondary" onClick={onOpen}>
              <Eye className="w-3.5 h-3.5" /> Ver
            </Button>
          )}
          {onEdit && isOpen && (
            <Button size="sm" variant="secondary" onClick={onEdit} title={hasPaidItems ? "Lo ya cobrado no cambia: se edita lo que falta por cobrar" : undefined}>
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          )}
          {onServe && comanda.status === "enviada" && (
            <Button size="sm" onClick={onServe}>
              <CheckCheck className="w-3.5 h-3.5" /> Servida
            </Button>
          )}
          {onMove && isOpen && (
            <Button size="sm" variant="secondary" onClick={onMove}>
              <ArrowRightLeft className="w-3.5 h-3.5" /> Cambiar de mesa
            </Button>
          )}
          {onCancel && isOpen && (
            <Button size="sm" variant="destructive" onClick={onCancel}>
              <Ban className="w-3.5 h-3.5" /> {hasPaidItems ? "Quitar lo pendiente" : "Anular"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
