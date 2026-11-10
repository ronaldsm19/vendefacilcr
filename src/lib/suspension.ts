/**
 * Suspensión de un negocio: los motivos que elige el superadmin y los textos que ve cada quien.
 *
 * El motivo solo se le dice al dueño. El personal y cualquiera que abra la pantalla de ingreso ven
 * un texto neutro: a un mesero o a un cliente no le corresponde enterarse de que el negocio debe.
 */

export type SuspensionReason = "falta_pago" | "solicitud" | "otro";

export const SUSPENSION_REASONS: { value: SuspensionReason; label: string }[] = [
  { value: "falta_pago", label: "Falta de pago" },
  { value: "solicitud", label: "A pedido del negocio" },
  { value: "otro", label: "Otro motivo" },
];

export const SUSPENSION_MESSAGE_MAX = 300;

export function isSuspensionReason(value: unknown): value is SuspensionReason {
  return SUSPENSION_REASONS.some((r) => r.value === value);
}

export function suspensionReasonLabel(value: unknown): string {
  return SUSPENSION_REASONS.find((r) => r.value === value)?.label ?? "Sin motivo";
}

export interface SuspensionNotice {
  title: string;
  message: string;
  /** El mensaje que escribió el superadmin al suspender, solo para el dueño. */
  note: string;
}

const NEUTRAL: SuspensionNotice = {
  title: "Panel suspendido",
  message: "El acceso a este panel está suspendido por ahora. Si sos la persona encargada del negocio, contactá a VendeFácil.",
  note: "",
};

const FOR_OWNER: Record<SuspensionReason, Omit<SuspensionNotice, "note">> = {
  falta_pago: {
    title: "Acceso suspendido por falta de pago",
    message: "El panel y la tienda en línea quedan suspendidos hasta que se registre el pago. Contactá a VendeFácil para ponerte al día y reactivarlos.",
  },
  solicitud: {
    title: "Cuenta pausada",
    message: "Pausamos el panel y la tienda en línea a pedido tuyo. Contactá a VendeFácil cuando quieras reactivarlos.",
  },
  otro: {
    title: "Cuenta suspendida",
    message: "El panel y la tienda en línea están suspendidos. Contactá a VendeFácil para más información.",
  },
};

/** El aviso para el dueño (rol admin) o el neutro para el personal y la pantalla de ingreso. */
export function suspensionNotice(
  tenant: { suspendedReason?: string | null; suspendedMessage?: string | null },
  audience: "owner" | "neutral",
): SuspensionNotice {
  if (audience === "neutral") return NEUTRAL;
  const reason = isSuspensionReason(tenant.suspendedReason) ? tenant.suspendedReason : "otro";
  return { ...FOR_OWNER[reason], note: (tenant.suspendedMessage ?? "").trim() };
}

/** El aviso en una sola línea, para las respuestas de error del ingreso y de la app. */
export function suspensionText(notice: SuspensionNotice): string {
  return [`${notice.title}.`, notice.message, notice.note].filter(Boolean).join(" ");
}
