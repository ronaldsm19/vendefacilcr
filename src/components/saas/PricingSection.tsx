"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

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

const PLANS = [
  {
    name: "Emprende",
    price: "₡12.900",
    period: "/mes",
    description: "Para emprendedores que están comenzando",
    features: [
      "Hasta 20 productos en catálogo",
      "Gestión básica de pedidos",
      "Control de inventario",
      "Panel de administración",
      "Link público de catálogo",
      "Soporte por WhatsApp",
    ],
    popular: false,
    cta: "Empezar ahora",
  },
  {
    name: "Pro",
    price: "₡17.900",
    period: "/mes",
    description: "El favorito de los emprendedores activos",
    features: [
      "Productos ilimitados",
      "Gestión completa de pedidos",
      "Control de inventario avanzado",
      "Registro y análisis de gastos",
      "Reportes financieros mensuales",
      "Personalización de colores y logo",
      "Estadísticas de productos",
      "Soporte prioritario",
    ],
    popular: true,
    cta: "Quiero el Pro →",
  },
  {
    name: "Premium",
    price: "₡24.900",
    period: "/mes",
    description: "Para negocios con mayor volumen",
    features: [
      "Todo lo del plan Pro",
      "Múltiples administradores",
      "Dominio personalizado",
      "Onboarding personalizado 1:1",
      "Reportes avanzados exportables",
      "SLA de soporte garantizado",
      "Personalización avanzada",
    ],
    popular: false,
    cta: "Empezar ahora",
  },
];

function waUrl(planName: string) {
  return `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50661266865"}?text=${encodeURIComponent(
    `Hola! Me interesa el plan ${planName} de VendeFácil 🚀`
  )}`;
}

export default function PricingSection() {
  return (
    <section
      id="precios"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#0D0D14]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <motion.span
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
            {...fadeUp(0)}
          >
            Planes
          </motion.span>
          <motion.h2
            className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight mb-4"
            {...fadeUp(0.08)}
          >
            Elegí el plan para{" "}
            <span className="saas-accent-text">tu negocio</span>
          </motion.h2>
          <motion.p className="text-white/45" {...fadeUp(0.14)}>
            Todos los planes incluyen configuración guiada y soporte personalizado.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center max-w-5xl mx-auto">
          {PLANS.map((plan, i) => {
            if (plan.popular) {
              return (
                <motion.div
                  key={plan.name}
                  {...fadeUp(i * 0.1)}
                  className="relative scale-[1.04]"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)",
                    padding: "1px",
                    borderRadius: "20px",
                  }}
                >
                  {/* Popular badge */}
                  <span
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap saas-accent-bg"
                    style={{ boxShadow: "0 4px 20px rgba(59,130,246,0.4)" }}
                  >
                    ⭐ Más popular
                  </span>
                  <div
                    className="flex flex-col h-full rounded-[19px] p-7"
                    style={{ background: "#111118" }}
                  >
                    <div className="mb-5">
                      <h3 className="font-brand text-2xl font-bold text-white">{plan.name}</h3>
                      <p className="text-sm text-white/40 mt-1">{plan.description}</p>
                    </div>
                    <div className="mb-7">
                      <span className="text-4xl font-bold saas-accent-text">{plan.price}</span>
                      <span className="text-white/35 text-sm">{plan.period}</span>
                    </div>
                    <ul className="space-y-3 flex-1 mb-8">
                      {plan.features.map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2.5 text-sm text-white/65">
                          <Check className="w-4 h-4 text-blue-400 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={waUrl(plan.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center h-12 rounded-xl saas-accent-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      {plan.cta}
                    </a>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={plan.name}
                {...fadeUp(i * 0.1)}
                whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.14)" }}
                className="relative flex flex-col h-full rounded-2xl p-7 transition-all duration-300"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="mb-5">
                  <h3 className="font-brand text-2xl font-bold text-white">{plan.name}</h3>
                  <p className="text-sm text-white/40 mt-1">{plan.description}</p>
                </div>
                <div className="mb-7">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-white/35 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-center gap-2.5 text-sm text-white/55">
                      <Check className="w-4 h-4 text-blue-400/70 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={waUrl(plan.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center h-12 rounded-xl text-white/70 font-semibold text-sm hover:text-white transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {plan.cta}
                </a>
              </motion.div>
            );
          })}
        </div>

        {/* Setup fee note */}
        <motion.p
          className="text-center text-sm text-white/30 mt-12"
          {...fadeUp(0.4)}
        >
          ⚙️ Configuración inicial única desde{" "}
          <strong className="text-white/50">₡19.900</strong>{" "}
          · Incluye carga de tus primeros productos y capacitación
        </motion.p>
      </div>
    </section>
  );
}
