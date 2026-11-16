"use client";

import { useEffect, useRef } from "react";

/**
 * Un lector de códigos USB se porta como un teclado: "escribe" el código en milisegundos y termina
 * con Enter. Este hook escucha la página completa y, cuando llega una ráfaga así, llama a `onScan`
 * con el código. Una persona tecleando nunca va tan rápido, así que no se confunde con ella.
 *
 * No intercepta nada mientras el cursor está en un campo de texto: ahí el código cae en el campo,
 * y la pantalla decide qué hacer con su propio Enter (p. ej. el buscador de la caja).
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  { enabled = true, minLength = 3, maxGapMs = 60 }: { enabled?: boolean; minLength?: number; maxGapMs?: number } = {}
) {
  const callback = useRef(onScan);
  useEffect(() => { callback.current = onScan; });

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let last = 0;

    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
      if (target instanceof HTMLInputElement) {
        return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file"].includes(target.type);
      }
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isEditable(e.target)) { buffer = ""; return; }
      const now = performance.now();
      if (now - last > maxGapMs) buffer = "";
      last = now;

      if (e.key === "Enter") {
        if (buffer.length >= minLength) {
          // Si no, el Enter "presionaría" el último botón tocado (p. ej. la tarjeta de un producto).
          e.preventDefault();
          e.stopPropagation();
          callback.current(buffer);
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, minLength, maxGapMs]);
}
