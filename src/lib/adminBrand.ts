import { ENNEA_COLORS } from "@/components/brand/EnneaMark";

/**
 * Los colores del negocio dentro de su panel.
 *
 * Lo que es igual para todos los negocios (el menú, el buscador, la cuenta) va en el azul de Ennea. El
 * color del negocio queda para lo que es suyo: su logo, la sección en la que está parado y los botones
 * principales. Como el negocio puede elegir cualquier color (un amarillo claro, un café casi negro), el
 * tono se corre hacia más oscuro o más claro hasta que el texto encima se lea (4.5:1) y, en el menú, hasta
 * que la sección abierta se distinga del azul.
 */
export interface AdminBrandColors {
  /** Relleno de los botones principales, sobre fondo blanco. */
  fill: string;
  /** Texto sobre `fill`: blanco o azul Ennea, el que se lea mejor. */
  onFill: string;
  /** El color del negocio como texto o ícono sobre blanco. */
  ink: string;
  /** Fondo suave del color del negocio (detrás de un ícono en `ink`). */
  tint: string;
  /** La sección abierta en el menú, sobre el azul Ennea. */
  pill: string;
  /** Texto sobre `pill`. */
  onPill: string;
}

const WHITE = "#FFFFFF";
const BLACK = "#000000";
const NAVY = ENNEA_COLORS.navy;
const FALLBACK = "#6366F1";

function toRgb(hex: string): [number, number, number] {
  let s = String(hex ?? "").replace("#", "").trim();
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) s = FALLBACK.slice(1);
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function mix(a: string, b: string, t: number): string {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** Blanco o azul Ennea, el que se lea mejor sobre `bg`. */
function textOn(bg: string): string {
  return contrastRatio(WHITE, bg) >= contrastRatio(NAVY, bg) ? WHITE : NAVY;
}

function readsOn(bg: string): boolean {
  return Math.max(contrastRatio(WHITE, bg), contrastRatio(NAVY, bg)) >= 4.5;
}

export function adminBrandColors(primary: string): AdminBrandColors {
  const base = toHex(toRgb(primary));

  let fill = base;
  for (let i = 0; i < 12 && !readsOn(fill); i++) fill = mix(fill, BLACK, 0.1);

  let ink = base;
  for (let i = 0; i < 14 && contrastRatio(ink, WHITE) < 4.5; i++) ink = mix(ink, BLACK, 0.1);

  let pill = base;
  for (let i = 0; i < 12 && contrastRatio(pill, NAVY) < 3; i++) pill = mix(pill, WHITE, 0.12);
  for (let i = 0; i < 12 && !readsOn(pill); i++) pill = mix(pill, WHITE, 0.1);

  return { fill, onFill: textOn(fill), ink, tint: mix(base, WHITE, 0.88), pill, onPill: textOn(pill) };
}

/** Las variables CSS que usa el panel (`bg-[var(--admin-fill)]` y demás). */
export function adminBrandVars(primary: string): Record<string, string> {
  const c = adminBrandColors(primary);
  return {
    "--admin-fill": c.fill,
    "--admin-on-fill": c.onFill,
    "--admin-ink": c.ink,
    "--admin-tint": c.tint,
    "--admin-pill": c.pill,
    "--admin-on-pill": c.onPill,
  };
}
