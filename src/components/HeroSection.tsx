"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowDown, Sparkles, Store } from "lucide-react";
import { buildWhatsAppMessage, WhatsAppIcon } from "@/components/WhatsAppButton";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.7,
    delay,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
});

interface HeroSectionProps {
  whatsappNumber?: string;
  heroImageUrl?: string;
  tenantName?: string;
  logoUrl?: string;
  tagline?: string;
  subtagline?: string;
  badge?: string;
}

// Split tenant name: first word gets gradient, rest gets brand-dark
function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

export default function HeroSection({
  whatsappNumber,
  heroImageUrl,
  tenantName,
  logoUrl,
  tagline,
  subtagline,
  badge,
}: HeroSectionProps) {
  const displayName = tenantName || "Mi Tienda";
  const [namePart1, namePart2] = splitName(displayName);

  const displayTagline    = tagline    || "Tu tienda en línea, siempre disponible";
  const displaySubtagline = subtagline || "Pedidos fáciles y rápidos por WhatsApp";
  const displayBadge      = badge      || "📦 Pedidos por encargo";

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface">
      {/* ── Hero background image (optional) ── */}
      {heroImageUrl && (
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundImage: `url(${heroImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0" style={{ backgroundColor: "var(--color-brand-pink)", opacity: 0.7 }} />
        </div>
      )}


      {/* ── Gradient blobs ── */}
      <motion.div
        className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-brand-pink/20 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-brand-yellow/25 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-[40%] right-[15%] w-[300px] h-[300px] rounded-full bg-brand-orange/15 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* ── Main content ── */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Logo or icon */}
        <motion.div {...fadeUp(0.05)} className="flex justify-center mb-4">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={displayName}
              width={110}
              height={110}
              className="rounded-full drop-shadow-xl object-cover"
              priority
            />
          ) : (
            <div className="w-[110px] h-[110px] rounded-full gradient-bg flex items-center justify-center drop-shadow-xl">
              <Store className="w-12 h-12 text-white/90" />
            </div>
          )}
        </motion.div>

        {/* Eyebrow badge */}
        <motion.div {...fadeUp(0.1)}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-muted text-brand-pink text-sm font-semibold mb-6 border border-brand-pink/20">
            <Sparkles className="w-3.5 h-3.5" />
            {displayBadge}
          </span>
        </motion.div>

        {/* Brand name */}
        <motion.h1
          className="font-brand text-7xl md:text-8xl lg:text-9xl font-bold leading-none mb-4"
          {...fadeUp(0.2)}
        >
          <span className="gradient-text">{namePart1}</span>
          {namePart2 && (
            <>
              <br />
              <span className="text-brand-dark">{namePart2}</span>
            </>
          )}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          className="text-xl md:text-2xl text-brand-dark/60 font-light mb-3 tracking-wide"
          {...fadeUp(0.35)}
        >
          {displayTagline}
        </motion.p>

        {/* Sub-tagline */}
        <motion.p
          className="text-base md:text-lg text-brand-dark/60 mb-8 max-w-lg mx-auto leading-relaxed"
          {...fadeUp(0.45)}
        >
          {displaySubtagline}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          {...fadeUp(0.55)}
        >
          <a
            href={buildWhatsAppMessage(undefined, undefined, undefined, undefined, undefined, whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="whatsapp" size="lg" className="gap-2.5 px-8">
              <WhatsAppIcon size={20} />
              Ordenar por WhatsApp
            </Button>
          </a>
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              document
                .getElementById("productos")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Ver productos
          </Button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="mt-16 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <span className="text-xs text-brand-dark/30 uppercase tracking-widest">
            Descubre más
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown className="w-5 h-5 text-brand-pink/50" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
