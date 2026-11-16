/**
 * La etiqueta de un producto dibujada como imagen para la impresora de etiquetas del agente
 * (POST /etiqueta): 480 × 320 px en blanco y negro puro, que son los 60 × 40 mm del rollo a 203 dpi,
 * un píxel por punto de la impresora. Reproduce el mismo diseño que ProductLabelFace (la vista
 * previa y la impresión por el navegador): líneas de texto que se achican hasta caber, la fila
 * Peso · Precio · Lote y el código de barras Code 39 con el número abajo.
 *
 * Las barras se dibujan en píxeles enteros (la barra angosta mide 2 puntos) para que el lector las
 * lea bien; el texto se dibuja normal y después toda la imagen se pasa a blanco o negro, sin grises.
 */
import { code39Bars, type Code39Bars } from "@/lib/code39";
import {
  LABEL_HEIGHT_MM, LABEL_SIZE_PT, LABEL_WIDTH_MM, type LabelLine, type LabelRowValues, type ProductLabelFormat,
} from "@/lib/productLabel";

/** Puntos por milímetro de una térmica de 203 dpi (480 px / 60 mm). */
export const LABEL_PX_PER_MM = 8;
export const LABEL_PNG_WIDTH = LABEL_WIDTH_MM * LABEL_PX_PER_MM; // 480
export const LABEL_PNG_HEIGHT = LABEL_HEIGHT_MM * LABEL_PX_PER_MM; // 320

const MM = LABEL_PX_PER_MM;
const PT = (LABEL_PX_PER_MM * 25.4) / 72;
const FONT = "Arial, Helvetica, sans-serif";
/** Márgenes de la etiqueta, iguales a los de ProductLabelFace. */
const PAD_TOP = 1.8 * MM;
const PAD_X = 2 * MM;
const PAD_BOTTOM = 1.5 * MM;
const LINE_HEIGHT = 1.12;
const LINE_GAP = 0.6 * MM;
const MIN_TEXT_SCALE = 0.5;
/** Margen blanco a cada lado de las barras, en barras angostas (el lector lo necesita). */
const QUIET_MODULES = 10;
/** Más claro que esto pasa a blanco. Un poco por encima de la mitad para que el texto no salga flaco. */
const BLACK_BELOW = 150;

export type MeasureText = (text: string, fontPx: number, bold: boolean) => number;

/**
 * Parte un texto en renglones que quepan en `maxWidth`. Como en la vista previa
 * (overflow-wrap: anywhere), una palabra más ancha que el renglón se corta por letras.
 */
export function wrapText(text: string, maxWidth: number, fits: (s: string) => boolean): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const joined = current ? `${current} ${word}` : word;
    if (fits(joined)) { current = joined; continue; }
    if (current) out.push(current);
    current = "";
    let piece = "";
    for (const ch of word) {
      if (piece && !fits(piece + ch)) { out.push(piece); piece = ""; }
      piece += ch;
    }
    current = piece;
  }
  if (current) out.push(current);
  return out;
}

export interface LaidOutLine { text: string; fontPx: number; bold: boolean; gapBefore: number }

/**
 * Acomoda las líneas del formato en el alto disponible: las achica de a 5 % (hasta la mitad) hasta
 * que quepan, igual que la vista previa. Devuelve los renglones ya partidos y si se pasan del alto.
 */
export function layoutLines(lines: LabelLine[], maxWidth: number, maxHeight: number, measure: MeasureText) {
  const used = lines.filter((l) => l.text.trim());
  let scale = 1;
  for (;;) {
    const rows: LaidOutLine[] = [];
    let height = 0;
    used.forEach((line, i) => {
      const fontPx = LABEL_SIZE_PT[line.size] * PT * scale;
      const parts = wrapText(line.text.trim(), maxWidth, (s) => measure(s, fontPx, line.bold) <= maxWidth);
      parts.forEach((text, k) => {
        const gapBefore = k === 0 && i > 0 ? LINE_GAP : 0;
        rows.push({ text, fontPx, bold: line.bold, gapBefore });
        height += gapBefore + fontPx * LINE_HEIGHT;
      });
    });
    if (height <= maxHeight || scale <= MIN_TEXT_SCALE) return { rows, height, scale, overflow: height > maxHeight };
    scale = Math.round((scale - 0.05) * 100) / 100;
  }
}

export interface PlacedBarcode {
  bars: Code39Bars;
  /** Ancho de la barra angosta en puntos (2 lo ideal; 1 solo si el código es muy largo). */
  modulePx: number;
  ratio: number;
  widthPx: number;
}

/**
 * El código con barras de un número entero de puntos que quepa en el ancho: primero barra angosta
 * de 2 puntos con anchas de 3×; si no cabe, anchas más delgadas (2,5× y 2×, que el estándar
 * permite); y como último recurso barra de 1 punto.
 */
export function placeBarcode(code: string, maxWidthPx: number): PlacedBarcode | null {
  const options = [[2, 3], [2, 2.5], [2, 2], [1, 3], [1, 2]] as const;
  let last: PlacedBarcode | null = null;
  for (const [modulePx, ratio] of options) {
    const bars = code39Bars(code, ratio);
    if (!bars) return null;
    last = { bars, modulePx, ratio, widthPx: bars.width * modulePx };
    if ((bars.width + 2 * QUIET_MODULES) * modulePx <= maxWidthPx) return last;
  }
  return last;
}

/** Dibuja la etiqueta en un canvas de 480 × 320 en blanco y negro puro. Solo en el navegador. */
export function drawLabelCanvas(format: ProductLabelFormat, code: string, values?: LabelRowValues): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_PNG_WIDTH;
  canvas.height = LABEL_PNG_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const font = (px: number, bold: boolean) => `${bold ? 700 : 400} ${px}px ${FONT}`;
  const measure: MeasureText = (text, px, bold) => { ctx.font = font(px, bold); return ctx.measureText(text).width; };

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, LABEL_PNG_WIDTH, LABEL_PNG_HEIGHT);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const center = LABEL_PNG_WIDTH / 2;
  const innerWidth = LABEL_PNG_WIDTH - 2 * PAD_X;

  // De abajo hacia arriba: número, barras, fila de peso; lo que sobra es para el texto.
  let bottom = LABEL_PNG_HEIGHT - PAD_BOTTOM;
  if (format.showCode && code) {
    const px = 8 * PT;
    ctx.font = font(px, false);
    ctx.letterSpacing = `${0.2 * MM}px`;
    ctx.fillText(`*${code}*`, center, bottom - px / 2);
    ctx.letterSpacing = "0px";
    bottom -= px + 0.3 * MM;
  }
  const barHeight = Math.round((format.showCode ? 9 : 11) * MM);
  const placed = code ? placeBarcode(code, innerWidth) : null;
  if (placed) {
    const top = Math.round(bottom - barHeight);
    const left = Math.round((LABEL_PNG_WIDTH - placed.widthPx) / 2);
    for (const b of placed.bars.bars) {
      ctx.fillRect(left + Math.round(b.x * placed.modulePx), top, Math.round(b.w * placed.modulePx), barHeight);
    }
  }
  bottom -= barHeight + 1 * MM;

  if (format.weightRow) {
    const filled = !!values && !!(values.weight || values.price || values.lot);
    if (filled) {
      const captionPx = 6.5 * PT;
      const valuePx = 9 * PT;
      const colWidth = innerWidth / 3;
      const valueTop = bottom - valuePx * 1.1;
      const captionTop = valueTop - captionPx * 1.1;
      ([["Peso", values!.weight], ["Precio", values!.price], ["Lote", values!.lot]] as const).forEach(([name, value], i) => {
        const x = PAD_X + colWidth * i + colWidth / 2;
        ctx.font = font(captionPx, false);
        ctx.fillText(name, x, captionTop + (captionPx * 1.1) / 2);
        if (value) {
          ctx.font = font(valuePx, true);
          ctx.fillText(value, x, valueTop + (valuePx * 1.1) / 2, colWidth - 0.5 * MM);
        }
      });
      bottom = captionTop - 0.8 * MM;
    } else {
      // En blanco para escribir a mano: las tres palabras repartidas, como en la vista previa.
      const px = 9 * PT;
      const y = bottom - (px * 1.15) / 2;
      ctx.font = font(px, false);
      ctx.textAlign = "left";
      ctx.fillText("Peso", PAD_X + 2 * MM, y);
      ctx.textAlign = "right";
      ctx.fillText("Lote", LABEL_PNG_WIDTH - PAD_X - 2 * MM, y);
      ctx.textAlign = "center";
      ctx.fillText("Precio", center, y);
      bottom -= px * 1.15 + 0.8 * MM;
    }
  }

  const area = bottom - PAD_TOP;
  const { rows, height } = layoutLines(format.lines, innerWidth, area, measure);
  // Centradas en el alto que queda; si no caben ni achicadas, se cortan abajo como en la vista previa.
  let y = PAD_TOP + Math.max(0, (area - height) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, PAD_TOP, LABEL_PNG_WIDTH, area);
  ctx.clip();
  for (const row of rows) {
    y += row.gapBefore;
    ctx.font = font(row.fontPx, row.bold);
    ctx.fillText(row.text, center, y + (row.fontPx * LINE_HEIGHT) / 2);
    y += row.fontPx * LINE_HEIGHT;
  }
  ctx.restore();

  // Sin grises: cada píxel queda blanco o negro, que es lo único que imprime la térmica.
  const img = ctx.getImageData(0, 0, LABEL_PNG_WIDTH, LABEL_PNG_HEIGHT);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < BLACK_BELOW ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** La etiqueta como PNG en base64, sin el prefijo "data:", lista para POST /etiqueta. */
export function renderLabelPngBase64(format: ProductLabelFormat, code: string, values?: LabelRowValues): string {
  return drawLabelCanvas(format, code, values).toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
