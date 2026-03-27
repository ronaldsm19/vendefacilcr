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

const PROBLEMS = [
  { emoji: "💬", title: "Pedidos caóticos por WhatsApp",      desc: "Perdés pedidos, te confundís y hay clientes que se van sin comprar porque nunca respondiste a tiempo." },
  { emoji: "📷", title: "Catálogo improvisado en fotos",      desc: "Un álbum de fotos sin precios, sin descripciones y sin ninguna forma de hacer pedidos ordenados." },
  { emoji: "📊", title: "Sin control de tus finanzas",        desc: "No sabés con certeza cuánto ganás ni cuánto gastás. Las cuentas las hacés de memoria o en papel." },
  { emoji: "🌐", title: "Sin presencia web profesional",      desc: "No podés mandar un link que represente tu negocio bien. Perdés credibilidad antes de empezar." },
  { emoji: "📦", title: "Inventario que se te escapa",        desc: "Vendiste algo que ya no tenías. O tenés stock acumulado y no sabés que existe." },
  { emoji: "⏱️", title: "Tiempo perdido en lo operativo",    desc: "Precios, disponibilidad, cómo pedir — siempre respondés lo mismo, desde cero, todos los días." },
];

export default function ProblemSection() {
  return (
    <section
      id="problemas"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#06060A]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <motion.span
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
            {...fadeUp(0)}
          >
            El problema
          </motion.span>
          <motion.h2
            className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight mb-4"
            {...fadeUp(0.08)}
          >
            ¿Te suena{" "}
            <span className="saas-accent-text">familiar?</span>
          </motion.h2>
          <motion.p className="text-white/45 text-lg leading-relaxed" {...fadeUp(0.14)}>
            Hablamos con cientos de emprendedores. Todos vivían lo mismo.
          </motion.p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROBLEMS.map((p, i) => (
            <motion.div
              key={i}
              {...fadeUp(i * 0.07)}
              whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.16)" }}
              className="saas-card rounded-2xl p-6 transition-all duration-300 cursor-default"
            >
              <span className="text-2xl block mb-4">{p.emoji}</span>
              <h3 className="font-semibold text-white text-base mb-2">{p.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
