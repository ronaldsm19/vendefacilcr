// Reparto de una lista de ventas entre las formas de pago. Módulo puro (sin mongoose) para que lo
// usen igual el resumen del día y el cierre: si cada uno sumara por su cuenta, un pago mixto
// contado distinto haría que el cierre validara el datáfono contra un número que la pantalla
// nunca mostró.

export type PaymentMethod = "efectivo" | "sinpe" | "tarjeta" | "mixto";

export interface PaymentBreakdown {
  efectivo: number;
  sinpe: number;
  tarjeta: number;
}

export function emptyBreakdown(): PaymentBreakdown {
  return { efectivo: 0, sinpe: 0, tarjeta: 0 };
}

/** Orden en que se ofrecen al cobrar: de la más usada a la menos. */
export const PAYMENT_METHODS: PaymentMethod[] = ["efectivo", "sinpe", "tarjeta", "mixto"];

/** Para datos que vienen de la base o de una API y podrían traer cualquier cosa. */
export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as string[]).includes(v);
}

/** Las tres que pueden repartirse en un pago mixto. "mixto" no se reparte a sí mismo. */
export const SPLIT_METHODS: Exclude<PaymentMethod, "mixto">[] = ["efectivo", "sinpe", "tarjeta"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  sinpe:    "SINPE",
  tarjeta:  "Tarjeta",
  mixto:    "Mixto",
};

/** Para el ticket y cualquier texto plano, donde no hay iconos. */
export const PAYMENT_METHOD_EMOJI: Record<PaymentMethod, string> = {
  efectivo: "💵",
  sinpe:    "📱",
  tarjeta:  "💳",
  mixto:    "🔀",
};

export interface PaymentMethodStyle {
  /** Relleno de la opción elegida. */
  bg: string;
  /** Texto e icono sobre `bg`. */
  ink: string;
  /** Borde e icono cuando la opción NO está elegida, sobre blanco. */
  accent: string;
}

/**
 * Un color fijo por forma de pago, a propósito fuera de la paleta del negocio: acá el color no
 * decora, dice cuál es, y tiene que significar lo mismo en todos los negocios. Verde plata,
 * gris SINPE, azul tarjeta y ámbar para el repartido.
 *
 * `accent` no siempre es `bg`: el ámbar sobre blanco casi no se ve, así que el borde y el icono
 * van en un tono más oscuro que el relleno.
 */
export const PAYMENT_METHOD_STYLE: Record<PaymentMethod, PaymentMethodStyle> = {
  efectivo: { bg: "#16a34a", ink: "#ffffff", accent: "#16a34a" },
  sinpe:    { bg: "#475569", ink: "#ffffff", accent: "#475569" },
  tarjeta:  { bg: "#2563eb", ink: "#ffffff", accent: "#2563eb" },
  mixto:    { bg: "#f59e0b", ink: "#1a1a2e", accent: "#b45309" },
};

interface SaleLike {
  total?: number;
  paymentMethod?: string;
  mixedPayment?: { efectivo?: number; sinpe?: number; tarjeta?: number } | null;
}

/**
 * Suma las ventas por forma de pago. Una venta mixta se reparte según sus montos; una venta normal
 * carga su total al método que tenga. Un método desconocido no se inventa: queda fuera del
 * desglose, igual que antes.
 */
export function splitPayments(sales: SaleLike[]): PaymentBreakdown {
  const breakdown = emptyBreakdown();
  for (const sale of sales) {
    if (sale.paymentMethod === "mixto" && sale.mixedPayment) {
      breakdown.efectivo += sale.mixedPayment.efectivo ?? 0;
      breakdown.sinpe    += sale.mixedPayment.sinpe    ?? 0;
      breakdown.tarjeta  += sale.mixedPayment.tarjeta  ?? 0;
    } else {
      const method = sale.paymentMethod as keyof PaymentBreakdown;
      if (method in breakdown) breakdown[method] += sale.total ?? 0;
    }
  }
  return breakdown;
}
