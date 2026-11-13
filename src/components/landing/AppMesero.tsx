"use client";

import { useState } from "react";
import Image from "next/image";
import { Clock, LayoutGrid, Palette, UtensilsCrossed } from "lucide-react";

// La app de los meseros, con capturas reales de la app de Android (restaurante de demostración).

const PUNTOS = [
  {
    icon: LayoutGrid,
    titulo: "El salón en vivo",
    texto: "Cada mesa con su estado y cuánto lleva esperando. Lo que urge sale de primero.",
  },
  {
    icon: UtensilsCrossed,
    titulo: "La orden, desde la mesa",
    texto: "Marca los platos con su foto, anota el «sin cebolla» y la comanda sale impresa en cocina y en barra.",
  },
  {
    icon: Clock,
    titulo: "Su propia jornada",
    texto: "Cada mesero ve sus horas del día, de la quincena y del mes, sin preguntarle a nadie.",
  },
  {
    icon: Palette,
    titulo: "Con los colores de tu restaurante",
    texto: "Entra con su usuario y un PIN de cuatro dígitos, y la app se pinta con tu marca.",
  },
];

const TIENDAS = ["App Store", "Google Play", "AppGallery"];

function Telefono({ src, alt, className, priority }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <figure className={`lp-device ${className ?? ""}`}>
      <Image src={src} alt={alt} width={600} height={1300} sizes="(min-width: 980px) 260px, 62vw" priority={priority} />
    </figure>
  );
}

export default function AppMesero() {
  const [noche, setNoche] = useState(false);

  return (
    <section id="app" className="lp-section lp-section--warm" aria-labelledby="lp-app">
      <div className="lp-wrap lp-split lp-split--wide">
        <div data-reveal>
          <span className="lp-eyebrow">App para meseros · Plan Premium</span>
          <h2 id="lp-app" className="lp-h2">Tus meseros toman la orden desde el teléfono.</h2>
          <p className="lp-lead">
            Con la app de Ennea cada mesero ve el salón en vivo, toma la orden en la mesa y la manda directo a
            cocina y barra. Sin papelitos y sin carreras.
          </p>
          <ul className="lp-points">
            {PUNTOS.map((p) => (
              <li key={p.titulo}>
                <p.icon aria-hidden="true" />
                <div>
                  <strong>{p.titulo}</strong>
                  <p>{p.texto}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="lp-stores">
            <p className="lp-stores-now">
              <span className="lp-stores-dot" aria-hidden="true" />
              Hoy ya lo usan desde el navegador del teléfono.
            </p>
            <p className="lp-stores-soon">Y muy pronto, con su propia app en</p>
            <ul className="lp-stores-list">
              {TIENDAS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lp-app-stage" data-reveal>
          <div className="lp-devices">
            <Telefono
              src="/landing/app/comanda.webp"
              alt="App del mesero: comanda nueva de la mesa 1 con gallo pinto, batido de fresa y café, total ₡5 900."
              className="lp-device--side lp-device--left"
            />
            <Telefono
              src={noche ? "/landing/app/salon-noche.webp" : "/landing/app/salon-dia.webp"}
              alt={`App del mesero: el salón en vivo${noche ? " en modo oscuro" : ""}, con las mesas que hay que atender primero y los minutos que llevan esperando.`}
              className="lp-device--main"
              priority={false}
            />
            <Telefono
              src="/landing/app/mi-jornada.webp"
              alt="App del mesero: Mi jornada, con la jornada en curso y 70 horas en la quincena."
              className="lp-device--side lp-device--right"
            />
          </div>
          <div className="lp-app-toggle" role="group" aria-label="Apariencia de la app">
            <button type="button" aria-pressed={!noche} onClick={() => setNoche(false)}>Día</button>
            <button type="button" aria-pressed={noche} onClick={() => setNoche(true)}>Noche</button>
          </div>
          <p className="lp-app-note">Capturas reales de la app, con un restaurante de demostración.</p>
        </div>
      </div>
    </section>
  );
}
