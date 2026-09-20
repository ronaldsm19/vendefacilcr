"use client";

import { useEffect, useRef } from "react";

/**
 * Ejecuta `callback` ahora y luego cada `intervalMs` mientras `enabled` sea true.
 * - No solapa: el siguiente tick se agenda cuando termina el anterior (setTimeout encadenado).
 * - Se pausa con document.visibilityState === "hidden" y dispara un tick al volver a "visible".
 * - `callback` se lee desde un ref: cambiarlo no reinicia el ciclo.
 */
export function usePolling(callback: () => Promise<unknown> | unknown, intervalMs: number, enabled = true) {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(tick, intervalMs);
    };
    const tick = async () => {
      if (cancelled || inFlight) return;
      if (document.visibilityState === "hidden") return; // se reanuda en visibilitychange
      inFlight = true;
      try { await cbRef.current(); } catch { /* el siguiente tick reintenta */ }
      finally { inFlight = false; }
      schedule();
    };
    const onVisibility = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (document.visibilityState === "visible") tick();
    };

    document.addEventListener("visibilitychange", onVisibility);
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
