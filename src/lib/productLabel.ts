/**
 * Etiqueta adhesiva de un producto (la que se pega en el empaque): unas líneas de texto que arma
 * el negocio, y abajo el código de barras en Code 39. El formato se guarda en cada producto.
 */

/** Tamaño del rollo. Hoy un solo tamaño, el de las etiquetas térmicas de 60 × 40 mm. */
export const LABEL_WIDTH_MM = 60;
export const LABEL_HEIGHT_MM = 40;

export const LABEL_LINE_SIZES = ["lg", "md", "sm"] as const;
export type LabelLineSize = (typeof LABEL_LINE_SIZES)[number];
export const LABEL_SIZE_NAMES: Record<LabelLineSize, string> = { lg: "Grande", md: "Mediana", sm: "Pequeña" };
/** Puntos de cada tamaño antes de achicar para que todo quepa. */
export const LABEL_SIZE_PT: Record<LabelLineSize, number> = { lg: 11, md: 9, sm: 7.5 };

export const MAX_LABEL_LINES = 8;
export const MAX_LABEL_LINE = 120;
/** Cuántas etiquetas se mandan de una vez. */
export const MAX_LABEL_COPIES = 300;

export interface LabelLine {
  text: string;
  size: LabelLineSize;
  bold: boolean;
}

export interface ProductLabelFormat {
  lines: LabelLine[];
  /** El número debajo de las barras, entre asteriscos (*10001*). */
  showCode: boolean;
  /** Fila "Peso · Precio · Lote" sobre el código, para llenar a mano. */
  weightRow: boolean;
}

/** Formato de arranque para un producto que todavía no tiene: el nombre grande y la descripción. */
export function defaultLabel(product: { name: string; description?: string }): ProductLabelFormat {
  const lines: LabelLine[] = [{ text: product.name.trim(), size: "lg", bold: false }];
  const desc = (product.description ?? "").trim().replace(/\s+/g, " ");
  if (desc) lines.push({ text: desc.slice(0, MAX_LABEL_LINE), size: "md", bold: false });
  return { lines, showCode: true, weightRow: false };
}

/**
 * Valida un formato que llegó del navegador y lo devuelve limpio, o null si no sirve.
 * Las líneas vacías se descartan; el texto largo se rechaza (no se corta sin avisar).
 */
export function normalizeLabel(raw: unknown): ProductLabelFormat | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.lines) || r.lines.length > MAX_LABEL_LINES) return null;
  const lines: LabelLine[] = [];
  for (const item of r.lines) {
    if (typeof item !== "object" || item === null) return null;
    const l = item as Record<string, unknown>;
    if (typeof l.text !== "string") return null;
    const text = l.text.trim();
    if (text.length > MAX_LABEL_LINE) return null;
    const size = LABEL_LINE_SIZES.includes(l.size as LabelLineSize) ? (l.size as LabelLineSize) : "md";
    if (text) lines.push({ text, size, bold: l.bold === true });
  }
  return { lines, showCode: r.showCode !== false, weightRow: r.weightRow === true };
}
