"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PARQUE = { lat: 9.906022, lng: -83.684175 };
const TALLER = { lat: 9.9105789, lng: -83.6800366 };

function wazeUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}
function mapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function LocationRow({
  icon,
  title,
  subtitle,
  lat,
  lng,
}: {
  icon: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-brand-muted/40 border border-brand-pink/10">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-semibold text-brand-dark text-sm">{title}</p>
          <p className="text-xs text-brand-dark/50 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-1">
        <a
          href={wazeUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#05C8F7]/10 hover:bg-[#05C8F7]/20 border border-[#05C8F7]/30 text-xs font-semibold text-[#0097b2] transition-colors"
        >
          <WazeIcon />
          Waze
        </a>
        <a
          href={mapsUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4285F4]/10 hover:bg-[#4285F4]/20 border border-[#4285F4]/30 text-xs font-semibold text-[#4285F4] transition-colors"
        >
          <MapsIcon />
          Google Maps
        </a>
      </div>
    </div>
  );
}

interface AboutSectionProps {
  aboutData?: {
    title: string;
    paragraph1: string;
    paragraph2: string;
    images: string[];
  };
}

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=80&fit=crop",
  "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&q=80&fit=crop",
  "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80&fit=crop",
  "https://images.unsplash.com/photo-1560008581-09826d1de69e?w=400&q=80&fit=crop",
];

export default function AboutSection({ aboutData }: AboutSectionProps) {
  const [locationOpen, setLocationOpen] = useState(false);

  const title = aboutData?.title ?? "Hechos con amor en Turrialba";
  const paragraph1 = aboutData?.paragraph1 ?? "Dulce Pecado nació de un momento espontáneo, con muchas ganas de crear algo especial.";
  const paragraph2 = aboutData?.paragraph2 ?? "Hoy, cada postre y cada apretado gourmet está hecho con amor, buscando convertir lo simple en algo delicioso 🤍✨";
  const images = (aboutData?.images?.length ? aboutData.images : DEFAULT_IMAGES).map(
    (url, i) => ({ img: url || DEFAULT_IMAGES[i], rotate: ["-2deg", "2deg", "1.5deg", "-1.5deg"][i] })
  );

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50688888888";
  const specialOrderMsg = encodeURIComponent(
    `Hola! Me interesa hacer un pedido especial para un evento de *Dulce Pecado* 🍮🎉\n\n¿Podrías darme más información sobre opciones y disponibilidad? Gracias! 😊`
  );
  const specialOrderUrl = `https://wa.me/${whatsappNumber}?text=${specialOrderMsg}`;

  return (
    <section id="nosotros" className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* ── Text side ── */}
          <div>
            <span className="text-sm font-semibold text-brand-pink uppercase tracking-widest">
              Nuestra historia
            </span>
            <h2 className="font-brand text-4xl md:text-5xl font-bold text-brand-dark mt-3 mb-6 leading-tight">
              {title}
            </h2>
            <div className="space-y-4 text-brand-dark/65 leading-relaxed">
              <p>{paragraph1}</p>
              <p>{paragraph2}</p>
            </div>
          </div>

          {/* ── Visual side ── */}
          <div className="relative">
            {/* Background blob */}
            <div className="absolute inset-0 gradient-bg rounded-3xl opacity-10 blur-2xl scale-110" />

            {/* Decorative grid */}
            <div className="relative grid grid-cols-2 gap-4">
              {images.map((item, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl overflow-hidden shadow-lg card-shadow"
                  style={{ transform: `rotate(${item.rotate})` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt="Postre Dulce Pecado"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Feature cards ── */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Card 1 — static */}
          <div className="text-center p-6 rounded-2xl bg-brand-muted/50 border border-brand-pink/10">
            <span className="text-4xl">🧁</span>
            <p className="font-brand text-xl font-bold text-brand-dark mt-3">
              100% Artesanal
            </p>
            <p className="text-sm text-brand-dark/50 mt-1">
              Elaborado a mano con amor
            </p>
          </div>

          {/* Card 2 — opens location modal */}
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className="text-center p-6 rounded-2xl bg-brand-muted/50 border border-brand-pink/10 hover:border-brand-pink/40 hover:bg-brand-pink/5 transition-all cursor-pointer group"
          >
            <span className="text-4xl">🚗</span>
            <p className="font-brand text-xl font-bold text-brand-dark mt-3 group-hover:text-brand-pink transition-colors">
              Entregas en Turrialba
            </p>
            <p className="text-sm text-brand-dark/50 mt-1">
              Parque central (Parque Quesada Casal)
            </p>
            <p className="text-xs text-brand-pink/70 mt-2 font-medium">
              Ver ubicaciones →
            </p>
          </button>

          {/* Card 3 — opens WhatsApp */}
          <a
            href={specialOrderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center p-6 rounded-2xl bg-brand-muted/50 border border-brand-pink/10 hover:border-brand-pink/40 hover:bg-brand-pink/5 transition-all cursor-pointer group"
          >
            <span className="text-4xl">🎂</span>
            <p className="font-brand text-xl font-bold text-brand-dark mt-3 group-hover:text-brand-pink transition-colors">
              Pedidos especiales para eventos
            </p>
            <p className="text-sm text-brand-dark/50 mt-1">
              Personalizamos para ti
            </p>
            <p className="text-xs text-brand-pink/70 mt-2 font-medium">
              Consultar por WhatsApp →
            </p>
          </a>
        </div>
      </div>

      {/* ── Location modal ── */}
      <Dialog open={locationOpen} onOpenChange={setLocationOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📍 ¿Dónde encontrarnos?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <LocationRow
              icon="📌"
              title="Punto de entrega"
              subtitle="Parque Quesada Casal, Turrialba"
              lat={PARQUE.lat}
              lng={PARQUE.lng}
            />
            <LocationRow
              icon="🏠"
              title="Nuestro taller"
              subtitle="Ubicación de entrega de postres"
              lat={TALLER.lat}
              lng={TALLER.lng}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function WazeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M20.54 6.63C19.08 3.24 15.69 1 12 1 6.48 1 2 5.48 2 11c0 2.76 1.12 5.26 2.93 7.07l-.88 2.64c-.18.53.31 1.03.84.85l2.97-.99C9.03 21.48 10.48 22 12 22c5.52 0 10-4.48 10-10 0-1.96-.57-3.79-1.46-5.37zM12 20c-1.33 0-2.58-.37-3.65-1.01l-.35-.21-2.01.67.68-2.03-.22-.35C5.55 15.98 5 13.56 5 11c0-3.87 3.13-7 7-7 3.29 0 6.17 2.3 6.84 5.52.14.66.22 1.32.22 2 0 3.87-3.13 7-7 7zm3.5-9.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-7 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3.5 5c-1.48 0-2.75-.81-3.45-2h-.05c.18.62.5 1.18.93 1.63.69.71 1.62 1.12 2.57 1.12.95 0 1.88-.41 2.57-1.12.43-.45.75-1.01.93-1.63h-.05c-.7 1.19-1.97 2-3.45 2z"/>
    </svg>
  );
}

function MapsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  );
}
