"use client";

import { motion } from "framer-motion";
import { Globe, ShoppingCart, BarChart3, Package } from "lucide-react";

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

const FEATURES = [
  { icon: Globe,        title: "Tu página profesional",  desc: "Un catálogo online con tus productos y precios, listo para compartir con un link." },
  { icon: ShoppingCart, title: "Pedidos organizados",    desc: "Gestioná cada pedido desde un panel claro, sin perder ninguno ni complicarte." },
  { icon: BarChart3,    title: "Finanzas claras",        desc: "Sabé exactamente cuánto ganás y cuánto gastás cada mes, en una sola vista." },
  { icon: Package,      title: "Inventario al día",      desc: "Controlá tu stock en tiempo real y evitá vender lo que ya no tenés." },
];

const STATS = [
  { label: "Pedidos este mes",   value: "47",        color: "text-blue-400",    bg: "bg-blue-500/10"   },
  { label: "Ingresos del mes",   value: "₡285,000",  color: "text-purple-400",  bg: "bg-purple-500/10" },
  { label: "Productos activos",  value: "12",        color: "text-emerald-400", bg: "bg-emerald-500/10"},
  { label: "Gastos registrados", value: "₡68,400",   color: "text-blue-300",    bg: "bg-blue-500/10"   },
];

export default function SolutionSection() {
  return (
    <section
      id="caracteristicas"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#0D0D14]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <motion.span
              className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
              {...fadeUp(0)}
            >
              La solución
            </motion.span>
            <motion.h2
              className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight mb-5"
              {...fadeUp(0.08)}
            >
              Todo en{" "}
              <span className="saas-accent-text">un solo lugar</span>
            </motion.h2>
            <motion.p
              className="text-white/50 text-lg leading-relaxed mb-12"
              {...fadeUp(0.14)}
            >
              VendeFácil reúne todo lo que tu negocio necesita — sin código, sin complicaciones y desde el celular.
            </motion.p>

            <div className="space-y-8">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i}
                    className="flex items-start gap-4"
                    {...fadeUp(0.2 + i * 0.08)}
                  >
                    <div className="w-10 h-10 rounded-xl saas-accent-bg flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                      <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: live stats panel */}
          <motion.div
            className="rounded-2xl p-8"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            {...fadeUp(0.3)}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 mb-6">
              Tu panel en acción
            </p>
            <div className="space-y-3">
              {STATS.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl px-5 py-4 transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="text-sm text-white/50">{s.label}</span>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${s.color} ${s.bg}`}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/20 text-center mt-6">
              Datos de ejemplo · Tu negocio, tus números reales.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
