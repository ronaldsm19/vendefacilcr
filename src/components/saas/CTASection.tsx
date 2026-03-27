"use client";

import { motion } from "framer-motion";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: {
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    delay,
  },
});

const WA_URL = `https://wa.me/50661266865?text=${encodeURIComponent(
  "Hola! Quiero empezar con VendeFácil para mi negocio 🚀"
)}`;

export default function CTASection() {
  return (
    <section
      id="contacto"
      style={{ scrollMarginTop: "80px" }}
      className="relative py-32 px-6 bg-[#06060A] overflow-hidden"
    >
      {/* Radial gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(59,130,246,0.12) 0%, rgba(147,51,234,0.08) 40%, transparent 70%)",
        }}
      />

      {/* Subtle animated orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "rgba(59,130,246,0.06)", filter: "blur(80px)" }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "rgba(147,51,234,0.06)", filter: "blur(100px)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      {/* Border top glow */}
      <div
        className="absolute top-0 inset-x-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.4), rgba(147,51,234,0.4), transparent)" }}
      />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.span
          className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-6"
          {...fadeUp(0)}
        >
          ¿Listo para empezar?
        </motion.span>

        <motion.h2
          className="font-brand text-4xl md:text-6xl font-bold text-white leading-tight mb-6"
          {...fadeUp(0.08)}
        >
          Arrancá hoy.
          <br />
          Tu negocio no puede
          <br />
          <span className="saas-accent-text">esperar más.</span>
        </motion.h2>

        <motion.p
          className="text-white/50 text-lg max-w-xl mx-auto mb-10"
          {...fadeUp(0.16)}
        >
          Uníte a los emprendedores costarricenses que ya venden de forma profesional con VendeFácil.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          {...fadeUp(0.24)}
        >
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 h-14 px-8 rounded-full saas-accent-bg text-white font-semibold text-base hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Escribinos por WhatsApp
          </a>
          <a
            href="#precios"
            className="inline-flex items-center justify-center h-14 px-8 text-base rounded-full text-white/70 font-semibold hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
          >
            Ver planes
          </a>
        </motion.div>
      </div>
    </section>
  );
}
