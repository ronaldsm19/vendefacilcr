"use client";

import { motion } from "framer-motion";
import { Home, Leaf, Clock } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: <Home className="w-7 h-7 text-white" />,
    title: "Atención personalizada",
    subtitle: "Te acompañamos desde el pedido hasta la entrega",
  },
  {
    icon: <Leaf className="w-7 h-7 text-white" />,
    title: "Calidad garantizada",
    subtitle: "Productos seleccionados con cuidado y dedicación",
  },
  {
    icon: <Clock className="w-7 h-7 text-white" />,
    title: "Respuesta rápida",
    subtitle: "Coordinamos tu pedido fácil y rápido por WhatsApp",
  },
];

export default function TrustSection() {
  return (
    <section className="py-20 px-6 bg-surface-alt/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-sm font-semibold text-brand-pink uppercase tracking-widest mb-3"
          >
            Por qué elegirnos
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-brand text-4xl md:text-5xl font-bold text-brand-dark"
          >
            Calidad que{" "}
            <span className="gradient-text">nos distingue</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TRUST_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-center p-8 rounded-2xl bg-surface card-shadow hover:card-shadow-hover transition-shadow"
            >
              <div className="flex items-center justify-center w-16 h-16 rounded-full gradient-bg mx-auto mb-5 shadow-md">
                {item.icon}
              </div>
              <p className="font-brand text-xl font-bold text-brand-dark mb-2">
                {item.title}
              </p>
              <p className="text-sm text-brand-dark/55 leading-relaxed">
                {item.subtitle}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
