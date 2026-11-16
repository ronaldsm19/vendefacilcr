"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { code39Bars } from "@/lib/code39";
import {
  LABEL_HEIGHT_MM, LABEL_SIZE_PT, LABEL_WIDTH_MM, type ProductLabelFormat,
} from "@/lib/productLabel";

/** Módulo (barra angosta) ideal: 2 puntos en una térmica de 203 dpi, 3 en una de 300. */
const MODULE_MM = 0.25;
/** Más angosto que esto el lector empieza a fallar: el código es demasiado largo para la etiqueta. */
export const MIN_MODULE_MM = 0.17;
/** Ancho útil para las barras, con margen blanco de 10 módulos a cada lado. */
const BARS_AREA_MM = LABEL_WIDTH_MM - 4;
const QUIET_MODULES = 20;
/** Cuánto se puede achicar el texto para que quepa. */
const MIN_TEXT_SCALE = 0.5;

export interface LabelFit {
  /** 1 = el texto cupo en su tamaño; menos = se achicó. */
  scale: number;
  /** Ni achicado al mínimo cupo: se va a cortar. */
  overflow: boolean;
  /** Ancho de la barra angosta, en mm (null si no hay código). */
  moduleMm: number | null;
}

/**
 * Una etiqueta a tamaño real (60 × 40 mm) con estilos en línea: el mismo HTML se copia tal cual
 * para imprimir. El texto se achica solo hasta que quepa sobre el código de barras.
 */
const ProductLabelFace = forwardRef<HTMLDivElement, {
  format: ProductLabelFormat;
  code: string;
  onFit?: (fit: LabelFit) => void;
}>(function ProductLabelFace({ format, code, onFit }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current!, []);

  const bars = code ? code39Bars(code) : null;
  const moduleMm = bars ? Math.min(MODULE_MM, BARS_AREA_MM / (bars.width + QUIET_MODULES)) : null;
  const barHeightMm = format.showCode ? 9 : 11;

  const linesKey = JSON.stringify(format);
  useLayoutEffect(() => {
    const box = textRef.current;
    if (!box) return;
    let scale = 1;
    box.style.setProperty("--s", "1");
    while (scale > MIN_TEXT_SCALE && box.scrollHeight > box.clientHeight + 1) {
      scale = Math.round((scale - 0.05) * 100) / 100;
      box.style.setProperty("--s", String(scale));
    }
    onFit?.({ scale, overflow: box.scrollHeight > box.clientHeight + 1, moduleMm });
    // onFit cambia en cada render del padre; se mide solo cuando cambia lo que se imprime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, code, moduleMm]);

  return (
    <div
      ref={rootRef}
      style={{
        width: `${LABEL_WIDTH_MM}mm`,
        height: `${LABEL_HEIGHT_MM}mm`,
        boxSizing: "border-box",
        padding: "1.8mm 2mm 1.5mm",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#fff",
        color: "#000",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        ref={textRef}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: "center",
          lineHeight: 1.12,
          overflowWrap: "anywhere",
        }}
      >
        {format.lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: `calc(${LABEL_SIZE_PT[line.size]}pt * var(--s, 1))`,
              fontWeight: line.bold ? 700 : 400,
              marginTop: i === 0 ? 0 : "0.6mm",
            }}
          >
            {line.text}
          </div>
        ))}
      </div>

      {format.weightRow && (
        <div style={{ flex: "none", display: "flex", justifyContent: "space-between", padding: "0 2mm", marginTop: "0.8mm", fontSize: "9pt" }}>
          <span>Peso</span>
          <span>Precio</span>
          <span>Lote</span>
        </div>
      )}

      <div style={{ flex: "none", marginTop: "1mm", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {bars && moduleMm ? (
          <svg
            width={`${bars.width * moduleMm}mm`}
            height={`${barHeightMm}mm`}
            viewBox={`0 0 ${bars.width} 1`}
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
            style={{ display: "block" }}
          >
            {bars.bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={1} fill="#000" />)}
          </svg>
        ) : (
          <div style={{ width: "36mm", height: `${barHeightMm}mm`, border: "0.3mm dashed #999", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7pt", color: "#777" }}>
            Sin código
          </div>
        )}
        {format.showCode && (
          <div style={{ fontSize: "8pt", marginTop: "0.3mm", letterSpacing: "0.2mm", lineHeight: 1 }}>
            {code ? `*${code}*` : ""}
          </div>
        )}
      </div>
    </div>
  );
});

export default ProductLabelFace;

const PRINT_FRAME_ID = "vf-label-print-frame";

/**
 * Imprime `copies` veces la etiqueta ya dibujada, una por página de 60 × 40 mm, por la ventana de
 * impresión del navegador (ahí se elige la impresora de etiquetas).
 */
export function printLabels(label: HTMLElement, copies: number) {
  document.getElementById(PRINT_FRAME_ID)?.remove();
  const frame = document.createElement("iframe");
  frame.id = PRINT_FRAME_ID;
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  frame.srcdoc =
    `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>` +
    `@page{size:${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm;margin:0}` +
    `html,body{margin:0;padding:0}` +
    `body>div{break-after:page;page-break-after:always}` +
    `body>div:last-child{break-after:auto;page-break-after:auto}` +
    `</style></head><body>${label.outerHTML.repeat(copies)}</body></html>`;
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    win.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 500));
    win.focus();
    win.print();
  };
  document.body.appendChild(frame);
}
