"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

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

const BENEFITS = [
  "Página profesional que transmite confianza desde el primer clic",
  "Pedidos organizados — nunca más un cliente perdido por el caos de mensajes",
  "Control de inventario para saber qué tenés y qué necesitás reponer",
  "Finanzas claras: sabé exactamente cuánto ganás cada mes",
  "Acceso desde el celular, donde sea que estés",
  "Soporte en español con alguien que entiende tu negocio costarricense",
  "Un link que podés compartir en Instagram, WhatsApp y donde quieras",
];

export default function BenefitsSection() {
  return (
    <section
      id="beneficios"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#0D0D14]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <motion.span
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
            {...fadeUp(0)}
          >
            Beneficios
          </motion.span>
          <motion.h2
            className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight mb-4"
            {...fadeUp(0.08)}
          >
            Más tiempo para{" "}
            <span className="saas-accent-text">lo que amás</span>
          </motion.h2>
          <motion.p className="text-white/45 text-lg" {...fadeUp(0.14)}>
            VendeFácil se encarga de lo técnico para que vos te enfoqués en tu producto.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {BENEFITS.map((benefit, i) => (
            <motion.div
              key={i}
              {...fadeUp(i * 0.06)}
              whileHover={{ x: 4, borderColor: "rgba(255,255,255,0.14)" }}
              className="saas-card flex items-start gap-3.5 p-4 rounded-xl transition-all duration-300"
            >
              <CheckCircle2 className="w-4.5 h-4.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-white/60 text-sm leading-relaxed">{benefit}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
