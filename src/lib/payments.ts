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
