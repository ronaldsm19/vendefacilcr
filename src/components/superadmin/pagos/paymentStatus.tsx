import { AlertTriangle, Ban, Check, Clock, FileWarning, Gift, Hourglass, type LucideIcon } from "lucide-react";
import type { OwnerStatus } from "@/lib/mensualidad";

/** Evento de ventana: se aprobó o rechazó un comprobante (el menú actualiza su número). */
export const REVIEW_CHANGED_EVENT = "sa-review-changed";

/**
 * Estado de una mensualidad como lo ve el superadmin: el de la factura más el de la revisión del
 * comprobante. Cada estado lleva ícono y texto: el color solo no alcanza para distinguirlos.
 */
export const PAYMENT_STATE: Record<OwnerStatus, { label: string; className: string; icon: LucideIcon }> = {
  revision:   { label: "Por revisar", className: "sa-chip sa-chip-info",   icon: Hourglass },
  pendiente:  { label: "Pendiente",   className: "sa-chip sa-chip-warn",   icon: Clock },
  atrasada:   { label: "Atrasado",    className: "sa-chip sa-chip-danger", icon: AlertTriangle },
  rechazado:  { label: "Rechazado",   className: "sa-chip sa-chip-danger", icon: FileWarning },
  verificado: { label: "Pagado",      className: "sa-chip sa-chip-ok",     icon: Check },
  sin_costo:  { label: "Cortesía",    className: "sa-chip",                icon: Gift },
  anulada:    { label: "Anulado",     className: "sa-chip",                icon: Ban },
};

export function PaymentStateChip({ status }: { status: OwnerStatus }) {
  const s = PAYMENT_STATE[status];
  const Icon = s.icon;
  return <span className={s.className}><Icon aria-hidden />{s.label}</span>;
}
