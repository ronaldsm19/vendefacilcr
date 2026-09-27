// Arqueo de caja: denominaciones de colones y las cuentas del efectivo. Pantalla y servidor usan
// las mismas funciones; al editar un cierre el servidor recalcula todo con lo guardado.

export interface CashDenomination {
  valor: number;
  label: string;
  tipo: "moneda" | "billete";
}

export const CASH_DENOMINATIONS: CashDenomination[] = [
  { valor: 5,     label: "₡5",      tipo: "moneda" },
  { valor: 10,    label: "₡10",     tipo: "moneda" },
  { valor: 25,    label: "₡25",     tipo: "moneda" },
  { valor: 50,    label: "₡50",     tipo: "moneda" },
  { valor: 100,   label: "₡100",    tipo: "moneda" },
  { valor: 500,   label: "₡500",    tipo: "moneda" },
  { valor: 1000,  label: "₡1.000",  tipo: "billete" },
  { valor: 2000,  label: "₡2.000",  tipo: "billete" },
  { valor: 5000,  label: "₡5.000",  tipo: "billete" },
  { valor: 10000, label: "₡10.000", tipo: "billete" },
  { valor: 20000, label: "₡20.000", tipo: "billete" },
  { valor: 50000, label: "₡50.000", tipo: "billete" },
];

/** Tope por denominación: evita que un dedo de más guarde un conteo absurdo. */
export const MAX_DENOMINATION_COUNT = 100_000;

export interface ArqueoDenominacion {
  valor: number;
  cantidad: number;
  subtotal: number;
}

export interface Arqueo {
  denominaciones: ArqueoDenominacion[];
  totalContado: number;
  totalEsperado: number;
  diferencia: number;
}

/**
 * Efectivo que debería haber en la gaveta al cerrar: caja inicial + ventas en efectivo − retiros.
 * Con los datos guardados de un cierre da el mismo "esperado" que se calculó al cerrarlo.
 */
export function expectedCash(c: {
  openingAmount?: number;
  paymentBreakdown?: { efectivo?: number };
  withdrawalsTotal?: number;
}): number {
  return (c.openingAmount ?? 0) + (c.paymentBreakdown?.efectivo ?? 0) - (c.withdrawalsTotal ?? 0);
}

/**
 * Arma el arqueo a partir de cuántas piezas hay de cada denominación. Devuelve null si algo no es
 * válido: una denominación que no existe, repetida, o una cantidad que no es entero de 0 al tope.
 * Las denominaciones en cero no se guardan.
 */
export function buildArqueo(raw: unknown, totalEsperado: number): Arqueo | null {
  if (!Array.isArray(raw)) return null;
  const valid = new Set(CASH_DENOMINATIONS.map((d) => d.valor));
  const seen = new Set<number>();
  const denominaciones: ArqueoDenominacion[] = [];
  for (const d of raw) {
    const valor = d?.valor;
    const cantidad = d?.cantidad;
    if (!valid.has(valor) || seen.has(valor)) return null;
    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > MAX_DENOMINATION_COUNT) return null;
    seen.add(valor);
    if (cantidad > 0) denominaciones.push({ valor, cantidad, subtotal: valor * cantidad });
  }
  denominaciones.sort((a, b) => a.valor - b.valor);
  const totalContado = denominaciones.reduce((s, d) => s + d.subtotal, 0);
  return { denominaciones, totalContado, totalEsperado, diferencia: totalContado - totalEsperado };
}
