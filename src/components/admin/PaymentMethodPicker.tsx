"use client";

import { Banknote, Smartphone, CreditCard, Shuffle, Check } from "lucide-react";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_STYLE,
  type PaymentMethod,
} from "@/lib/payments";

export const PAYMENT_METHOD_ICONS = {
  efectivo: Banknote,
  sinpe:    Smartphone,
  tarjeta:  CreditCard,
  mixto:    Shuffle,
} as const;

/**
 * Elegir con qué paga el cliente. Cada forma tiene su color y su icono, siempre los mismos, y la
 * elegida se pinta entera con un check: la caja tenía que acercarse a leer un borde fino para
 * saber qué había marcado, y a mitad de fila eso se equivoca.
 *
 * Los colores salen de PAYMENT_METHOD_STYLE y no de la paleta del negocio: si el verde de
 * "efectivo" cambiara con cada tienda, dejaría de servir para reconocerlo de un vistazo.
 */
export default function PaymentMethodPicker({
  value,
  onChange,
  compact = false,
  className = "",
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  /** Menos alto, para la columna angosta del escritorio. Sigue siendo táctil. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Forma de pago" className={`grid grid-cols-2 gap-2 ${className}`}>
      {PAYMENT_METHODS.map((m) => {
        const Icon = PAYMENT_METHOD_ICONS[m];
        const style = PAYMENT_METHOD_STYLE[m];
        const selected = value === m;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(m)}
            style={
              selected
                ? { background: style.bg, borderColor: style.bg, color: style.ink, boxShadow: `0 0 0 3px ${style.bg}40` }
                : { borderColor: `${style.accent}66`, background: `${style.accent}0f` }
            }
            // Cambio casi instantáneo a propósito: en caja el color tiene que confirmar el toque,
            // no animarse mientras la mano ya va al siguiente botón.
            className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-colors duration-75 cursor-pointer hover:brightness-95 ${
              compact ? "py-2.5" : "py-3.5"
            } ${selected ? "" : "text-brand-dark"}`}
          >
            {selected && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/90 flex items-center justify-center"
              >
                <Check className="w-3 h-3" strokeWidth={3.5} style={{ color: style.bg }} />
              </span>
            )}
            <Icon
              className={compact ? "w-6 h-6" : "w-7 h-7"}
              strokeWidth={selected ? 2.4 : 2}
              style={{ color: selected ? style.ink : style.accent }}
            />
            <span className={`font-bold leading-none ${compact ? "text-[11px]" : "text-xs"}`}>
              {PAYMENT_METHOD_LABELS[m]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * La forma de pago ya elegida, para recordarla al confirmar el cobro o marcarla en una lista.
 * `solid` pesa y sirve para un solo dato destacado; `soft` es para una columna de tabla, donde
 * cuatro píldoras llenas de color pelearían con todo lo demás.
 */
export function PaymentMethodChip({
  method,
  variant = "solid",
  className = "",
}: {
  method: PaymentMethod;
  variant?: "solid" | "soft";
  className?: string;
}) {
  const Icon = PAYMENT_METHOD_ICONS[method];
  const style = PAYMENT_METHOD_STYLE[method];
  const solid = variant === "solid";
  return (
    <span
      style={
        solid
          ? { background: style.bg, color: style.ink }
          : { background: `${style.accent}1a`, color: style.accent }
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} />
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
}

/**
 * Icono y nombre sueltos, sin fondo: para filas densas y resúmenes donde lo que manda es el
 * monto y la forma de pago solo tiene que reconocerse de reojo. El color va en el icono.
 */
export function PaymentMethodLabel({
  method,
  className = "",
  iconClass = "w-3.5 h-3.5",
}: {
  method: PaymentMethod;
  className?: string;
  iconClass?: string;
}) {
  const Icon = PAYMENT_METHOD_ICONS[method];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon
        className={`${iconClass} shrink-0`}
        strokeWidth={2.4}
        style={{ color: PAYMENT_METHOD_STYLE[method].accent }}
      />
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
}
