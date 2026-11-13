// La marca Ennea: una campana de servicio. Cúpula y bandeja van en el color del texto; la perilla y el
// brillo, en latón. Cada parte lleva su clase (ennea-dome, ennea-knob, ennea-shine) para que una hoja de
// estilos pueda cambiarle los colores según el fondo.

export const ENNEA_COLORS = {
  navy: "#15223B",
  brass: "#B8902F",
  ivory: "#F6F1E6",
  fog: "#EEF1F5",
  slate: "#4A5468",
} as const;

export function EnneaMark({
  size = 32,
  className,
  title,
  dome = "currentColor",
  knob = ENNEA_COLORS.brass,
  shine = ENNEA_COLORS.brass,
}: {
  size?: number;
  className?: string;
  /** Si se pasa, el dibujo se anuncia con ese nombre; si no, queda como decoración. */
  title?: string;
  dome?: string;
  knob?: string;
  /** "none" para dibujarla sin brillo (en tamaños muy chicos no se distingue). */
  shine?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path className="ennea-dome" d="M17 67 A33 33 0 0 1 83 67 Z" fill={dome} />
      <rect className="ennea-dome" x="10" y="71" width="80" height="8" rx="4" fill={dome} />
      <circle className="ennea-knob" cx="50" cy="28" r="5.5" fill={knob} />
      {shine !== "none" && (
        <path
          className="ennea-shine"
          d="M29 58 A22 22 0 0 1 41 42"
          fill="none"
          stroke={shine}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
