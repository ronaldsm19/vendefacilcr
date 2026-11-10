"use client";

import { useEffect } from "react";

/**
 * Hace aparecer los bloques marcados con data-reveal cuando se llega a ellos. No dibuja nada.
 * Sin este script (o con "reducir movimiento" activado) todo el contenido se ve desde el inicio:
 * la página solo esconde bloques después de que esto la marca con data-motion="on".
 */
export default function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Lo que ya está a la vista se queda como está: se marca antes de activar el efecto, sin parpadeo.
    for (const el of items) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.setAttribute("data-in", "");
    }
    root.setAttribute("data-motion", "on");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    for (const el of items) if (!el.hasAttribute("data-in")) io.observe(el);

    return () => {
      io.disconnect();
      root.removeAttribute("data-motion");
    };
  }, []);

  return null;
}
