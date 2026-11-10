/**
 * Qué incluye cada plan, tal como se publica en el landing: las tarjetas de precios y la tabla de
 * comparación salen de acá. Los precios no: esos vienen de la configuración de cobros.
 */

import type { PlanKey } from "@/lib/billing";

/** Tope de productos del plan Emprende. */
export const EMPRENDE_MAX_PRODUCTS = 30;

export interface PlanCard {
  key: PlanKey;
  /** Para qué tipo de negocio es. */
  para: string;
  /** Plan del que parte ("Todo lo de Pro, más:"); null en el primero. */
  parteDe: PlanKey | null;
  incluye: string[];
  destacado?: boolean;
}

export const PLAN_CARDS: PlanCard[] = [
  {
    key: "emprende",
    para: "Para vender por encargo y por WhatsApp.",
    parteDe: null,
    incluye: [
      "Tu tienda en línea, con tu logo y tus colores",
      "Pedidos por WhatsApp con el producto y el total ya escritos",
      "Menú digital para compartir",
      `Hasta ${EMPRENDE_MAX_PRODUCTS} productos con fotos, extras y ofertas`,
      "Pedidos y ventas anotados en un solo lugar",
      "Existencias de cada producto",
      "Lo vendido hoy y en el mes",
    ],
  },
  {
    key: "pro",
    para: "Para sodas y cafeterías que cobran en caja.",
    parteDe: "emprende",
    incluye: [
      "Productos sin límite",
      "Punto de venta: efectivo, SINPE, tarjeta o pago mixto",
      "Tiquete impreso y cierre de caja con conteo",
      "Salón con mesas y reservas",
      "Gastos: una foto de la factura y se llena sola",
      "Costo y ganancia de cada receta",
      "Finanzas: ingresos, gastos, ganancia y margen",
    ],
  },
  {
    key: "premium",
    para: "Para restaurantes con meseros y cocina.",
    parteDe: "pro",
    destacado: true,
    incluye: [
      "Usuarios para cajeros y meseros, cada uno con su PIN",
      "Comandas desde la mesa, con notas y extras",
      "Impresión separada en cocina y en bebidas",
      "Cobro por partes de una misma mesa",
      "Marcaje de jornada y planilla del personal",
      "Reparto del 10% de servicio según las horas",
    ],
  },
];

/** true = incluido, false = no incluido, texto = incluido con esa condición. */
export type PlanCell = boolean | string;

export interface PlanMatrixGroup {
  grupo: string;
  filas: { que: string; planes: [PlanCell, PlanCell, PlanCell] }[];
}

/** Columnas en el orden de PLAN_KEYS: Emprende, Pro, Premium. */
export const PLAN_MATRIX: PlanMatrixGroup[] = [
  {
    grupo: "Vender",
    filas: [
      { que: "Tienda en línea y pedidos por WhatsApp", planes: [true, true, true] },
      { que: "Menú digital", planes: [true, true, true] },
      { que: "Productos", planes: [`Hasta ${EMPRENDE_MAX_PRODUCTS}`, "Sin límite", "Sin límite"] },
      { que: "Registro de pedidos y ventas", planes: [true, true, true] },
      { que: "Punto de venta: efectivo, SINPE, tarjeta o mixto", planes: [false, true, true] },
      { que: "Impuesto, 10% de servicio y propina en la cuenta", planes: [false, true, true] },
      { que: "Tiquete impreso", planes: [false, true, true] },
    ],
  },
  {
    grupo: "Salón y cocina",
    filas: [
      { que: "Mapa de mesas y reservas", planes: [false, true, true] },
      { que: "Comandas desde la mesa", planes: [false, false, true] },
      { que: "Impresión en cocina y en bebidas", planes: [false, false, true] },
      { que: "Cobro por partes de una mesa", planes: [false, false, true] },
    ],
  },
  {
    grupo: "Controlar la plata",
    filas: [
      { que: "Lo vendido hoy y en el mes", planes: [true, true, true] },
      { que: "Existencias de productos", planes: [true, true, true] },
      { que: "Cierre de caja con conteo", planes: [false, true, true] },
      { que: "Gastos con lectura de la factura", planes: [false, true, true] },
      { que: "Ingredientes, recetas y costo por plato", planes: [false, true, true] },
      { que: "Finanzas: ganancia y margen", planes: [false, true, true] },
    ],
  },
  {
    grupo: "Tu equipo",
    filas: [
      { que: "Quién puede entrar", planes: ["Solo el dueño", "Solo el dueño", "Dueño, cajeros y meseros"] },
      { que: "Marcaje de jornada", planes: [false, false, true] },
      { que: "Planilla y reparto del servicio", planes: [false, false, true] },
    ],
  },
  {
    grupo: "Acompañamiento",
    filas: [
      { que: "Configuración inicial y capacitación", planes: [true, true, true] },
      { que: "Soporte por WhatsApp", planes: [true, true, true] },
    ],
  },
];
