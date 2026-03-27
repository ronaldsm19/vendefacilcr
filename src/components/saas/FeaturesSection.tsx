"use client";

import { motion } from "framer-motion";
import { Globe, ShoppingBag, Package, Receipt, BarChart3, Settings, Smartphone, MessageCircle } from "lucide-react";

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
  { icon: Globe,         title: "Página pública",          desc: "Catálogo online con tus colores y productos, listo para compartir." },
  { icon: ShoppingBag,   title: "Gestión de pedidos",      desc: "Panel para ver, confirmar y actualizar cada pedido recibido." },
  { icon: Package,       title: "Control de inventario",   desc: "Stock en tiempo real con alertas cuando el nivel está bajo." },
  { icon: Receipt,       title: "Registro de gastos",      desc: "Anotá compras con foto de factura para conocer tu costo real." },
  { icon: BarChart3,     title: "Reportes financieros",    desc: "Ingresos, gastos y ganancia neta en una sola pantalla." },
  { icon: Settings,      title: "Configuración propia",    desc: "Personalizá textos, horarios y métodos de pago cuando quieras." },
  { icon: Smartphone,    title: "100% móvil",              desc: "Panel optimizado para teléfono. Gestioná tu negocio desde donde estés." },
  { icon: MessageCircle, title: "Integración WhatsApp",    desc: "Los pedidos llegan organizados directamente a tu WhatsApp." },
];

export default function FeaturesSection() {
  return (
    <section
      id="features"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#0D0D14]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <motion.span
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
            {...fadeUp(0)}
          >
            Características
          </motion.span>
          <motion.h2
            className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight"
            {...fadeUp(0.08)}
          >
            Funciones pensadas para{" "}
            <span className="saas-accent-text">tu negocio</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                {...fadeUp(i * 0.05)}
                whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.16)" }}
                className="saas-card rounded-2xl p-6 transition-all duration-300 cursor-default"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
