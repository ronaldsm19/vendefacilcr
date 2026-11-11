"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand, DemoButton } from "./shared";

const LINKS = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "La app", href: "#app" },
  { label: "Tus números", href: "#numeros" },
  { label: "Planes", href: "#planes" },
  { label: "Preguntas", href: "#preguntas" },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    // Si la página se abre ya desplazada (recarga o ancla), se revisa una vez al pintar.
    const first = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="lp-nav" data-scrolled={scrolled} data-open={open}>
      <div className="lp-wrap">
        <div className="lp-nav-row">
          <Brand />
          <nav className="lp-nav-links" aria-label="Secciones">
            {LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
          <div className="lp-nav-cta">
            <DemoButton size="sm" />
          </div>
          <button
            type="button"
            className="lp-nav-toggle"
            aria-expanded={open}
            aria-controls="lp-nav-panel"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <nav id="lp-nav-panel" className="lp-nav-panel" aria-label="Secciones">
            {LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
            <DemoButton block />
          </nav>
        )}
      </div>
    </header>
  );
}
