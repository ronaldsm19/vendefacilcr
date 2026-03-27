"use client";

import { motion } from "framer-motion";
import { MessageCircle, LayoutDashboard, Share2, TrendingUp } from "lucide-react";

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

const STEPS = [
  { num: "01", icon: MessageCircle,   title: "Nos contactás",         desc: "Escribinos por WhatsApp. En menos de 24h tenés tu página configurada y lista." },
  { num: "02", icon: LayoutDashboard, title: "Cargamos todo",         desc: "Subimos tus productos, fotos, precios y configuramos el perfil de tu negocio." },
  { num: "03", icon: Share2,          title: "Publicás tu link",      desc: "Un enlace que funciona en Instagram, WhatsApp, y donde sea que publiques." },
  { num: "04", icon: TrendingUp,      title: "Administrás y crecés",  desc: "Panel de control completo: pedidos, inventario, finanzas — todo en un lugar." },
];

export default function HowItWorks() {
  return (
    <section
      id="como-funciona"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#06060A] relative overflow-hidden"
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.15), rgba(147,51,234,0.15), transparent)" }}
      />

      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-20">
          <motion.span
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
            {...fadeUp(0)}
          >
            El proceso
          </motion.span>
          <motion.h2
            className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight"
            {...fadeUp(0.08)}
          >
            Cómo{" "}
            <span className="saas-accent-text">funciona</span>
          </motion.h2>
          <motion.p className="text-white/45 mt-4 text-lg" {...fadeUp(0.14)}>
            Cuatro pasos. Tu negocio en línea.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div key={i} {...fadeUp(i * 0.1)} className="relative">
                {/* Connector line (desktop) */}
                {i < STEPS.length - 1 && (
                  <div
                    className="absolute top-5 left-full w-full h-px hidden lg:block pointer-events-none"
                    style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.3), transparent)", width: "calc(100% - 40px)", left: "40px" }}
                  />
                )}
                {/* Step number */}
                <p className="font-brand text-5xl font-bold saas-accent-text opacity-25 mb-5 leading-none">
                  {step.num}
                </p>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}
                >
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
