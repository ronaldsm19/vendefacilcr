/**
 * Code 39: la simbología de las etiquetas que ya usan los negocios (la imprimen con apps de
 * etiquetas y la lee cualquier lector sin configurar nada). Cada carácter son 9 elementos
 * (5 barras y 4 espacios intercalados), 3 de ellos anchos, y entre carácter y carácter va un
 * espacio angosto. El código va entre asteriscos, que marcan inicio y fin y el lector no manda.
 */

/** Barras anchas de cada patrón (B = ancha, n = angosta), de la primera a la quinta. */
const BARS: Record<string, string> = {
  "1": "BnnnB", "2": "nBnnB", "3": "BBnnn", "4": "nnBnB", "5": "BnBnn",
  "6": "nBBnn", "7": "nnnBB", "8": "BnnBn", "9": "nBnBn", "0": "nnBBn",
};

/** Grupos de 10 caracteres que comparten el lugar del espacio ancho (0 = primer espacio). */
const GROUPS: { chars: string; wideSpace: number }[] = [
  { chars: "1234567890", wideSpace: 1 },
  { chars: "ABCDEFGHIJ", wideSpace: 2 },
  { chars: "KLMNOPQRST", wideSpace: 3 },
  { chars: "UVWXYZ-. *", wideSpace: 0 },
];

/** Los cuatro signos que tienen las barras angostas y tres espacios anchos. */
const ALL_NARROW_BARS: Record<string, number[]> = {
  $: [0, 1, 2],
  "/": [0, 1, 3],
  "+": [0, 2, 3],
  "%": [1, 2, 3],
};

/** Patrón de cada carácter: 9 elementos, true = ancho. */
const PATTERNS: Map<string, boolean[]> = (() => {
  const map = new Map<string, boolean[]>();
  for (const { chars, wideSpace } of GROUPS) {
    [...chars].forEach((ch, i) => {
      const bars = BARS["1234567890"[i]];
      const pattern: boolean[] = [];
      for (let k = 0; k < 5; k++) {
        pattern.push(bars[k] === "B");
        if (k < 4) pattern.push(k === wideSpace);
      }
      map.set(ch, pattern);
    });
  }
  for (const [ch, spaces] of Object.entries(ALL_NARROW_BARS)) {
    const pattern: boolean[] = [];
    for (let k = 0; k < 5; k++) {
      pattern.push(false);
      if (k < 4) pattern.push(spaces.includes(k));
    }
    map.set(ch, pattern);
  }
  return map;
})();

/** Patrón de un carácter (9 elementos, true = ancho), o null si Code 39 no lo tiene. */
export function code39Pattern(ch: string): boolean[] | null {
  return PATTERNS.get(ch) ?? null;
}

/** Si el texto se puede imprimir en Code 39 (en mayúsculas, sin el asterisco). */
export function canEncodeCode39(text: string): boolean {
  return text.length > 0 && [...text].every((ch) => ch !== "*" && PATTERNS.has(ch));
}

export interface Code39Bars {
  /** Barras negras: dónde empieza cada una y cuánto mide, en módulos (1 = elemento angosto). */
  bars: { x: number; w: number }[];
  /** Ancho total sin márgenes, en módulos. */
  width: number;
}

/**
 * Barras de un código en Code 39, con los asteriscos de inicio y fin ya puestos.
 * `ratio` es cuánto mide un elemento ancho respecto del angosto (3 es lo más fácil de leer).
 * Devuelve null si el texto trae caracteres que Code 39 no tiene.
 */
export function code39Bars(text: string, ratio = 3): Code39Bars | null {
  const value = text.toUpperCase();
  if (!canEncodeCode39(value)) return null;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  [..."*" + value + "*"].forEach((ch, idx) => {
    if (idx > 0) x += 1; // espacio angosto entre caracteres
    PATTERNS.get(ch)!.forEach((wide, k) => {
      const w = wide ? ratio : 1;
      if (k % 2 === 0) bars.push({ x, w });
      x += w;
    });
  });
  return { bars, width: x };
}
