"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductImageCarouselProps {
  images: string[];
  alt: string;
  className?: string;
  sizes?: string;
  /** Milisegundos entre cada cambio automático. Default: 20000 (20 segundos) */
  intervalMs?: number;
  showArrows?: boolean;
  onCurrentChange?: (index: number) => void;
}

export default function ProductImageCarousel({
  images,
  alt,
  className = "object-cover",
  sizes,
  intervalMs = 20_000,
  showArrows = false,
  onCurrentChange,
}: ProductImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const count = images.length;

  // Notificar al padre cuando current cambia (sin hacerlo dentro de un setter)
  useEffect(() => {
    onCurrentChange?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Resetear cuando cambia el producto (primer src cambia)
  useEffect(() => {
    setCurrent(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images[0]]);

  // Auto-rotación
  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  function goTo(index: number, e?: React.MouseEvent) {
    e?.stopPropagation();
    setCurrent(index);
  }

  function go(delta: number, e: React.MouseEvent) {
    e.stopPropagation();
    goTo((current + delta + count) % count);
  }

  if (count === 0) return null;

  return (
    <div className="relative w-full h-full">
      {images.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Image
            src={src}
            alt={count > 1 ? `${alt} – foto ${i + 1}` : alt}
            fill
            className={className}
            sizes={sizes}
            priority={i === 0}
          />
        </div>
      ))}

      {count > 1 && (
        <>
          {/* Indicador de puntos */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-auto">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir a foto ${i + 1}`}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "bg-white w-4 h-1.5"
                    : "bg-white/55 w-1.5 h-1.5 hover:bg-white/80"
                }`}
              />
            ))}
          </div>

          {/* Flechas opcionales */}
          {showArrows && (
            <>
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={(e) => go(-1, e)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/55 rounded-full p-1.5 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                type="button"
                aria-label="Foto siguiente"
                onClick={(e) => go(1, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/55 rounded-full p-1.5 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
