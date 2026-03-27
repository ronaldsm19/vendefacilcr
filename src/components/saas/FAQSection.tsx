"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

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

const FAQS = [
  {
    q: "¿En cuánto tiempo puedo tener mi página lista?",
    a: "En menos de 24 horas. Una vez que confirmás el pago, cargamos tus productos, configuramos tu perfil y te entregamos tu link listo para compartir.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "Para nada. El panel es muy intuitivo y te damos una capacitación para que aprendás a usarlo en 30 minutos. Además tenés soporte por WhatsApp si necesitás ayuda.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí, podés subir de plan en cualquier momento. El cambio aplica al siguiente ciclo de facturación sin penalidades.",
  },
  {
    q: "¿Qué pasa con mis datos si decido cancelar?",
    a: "Tus datos son tuyos. Si cancelás, te damos un período de 30 días para exportar toda tu información antes de que se elimine.",
  },
  {
    q: "¿El pago es mensual o anual?",
    a: "Los planes son mensuales con renovación automática. No hay contratos de largo plazo ni penalidades por cancelar cuando quieras.",
  },
  {
    q: "¿Puedo poner mi propio dominio como mipasteleria.com?",
    a: "Sí, en el plan Premium incluimos la configuración de dominio personalizado. En los otros planes la URL es tutienda.vendefacil.cr.",
  },
  {
    q: "¿El sistema funciona solo para comida o para otros negocios también?",
    a: "Está pensado especialmente para emprendedores de comida y postres, pero funciona para cualquier negocio que quiera vender por catálogo con pedidos por WhatsApp.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#06060A]"
    >
      <div className="max-w-3xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <motion.span
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
            {...fadeUp(0)}
          >
            Preguntas frecuentes
          </motion.span>
          <motion.h2
            className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight"
            {...fadeUp(0.08)}
          >
            Resolvemos tus{" "}
            <span className="saas-accent-text">dudas</span>
          </motion.h2>
        </div>

        <motion.div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          {...fadeUp(0.1)}
        >
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={i < FAQS.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.06)" } : {}}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors cursor-pointer"
                style={{ background: openIndex === i ? "rgba(255,255,255,0.04)" : "transparent" }}
                aria-expanded={openIndex === i}
              >
                <span className="font-medium text-white/75 pr-4 text-sm sm:text-base leading-relaxed">
                  {faq.q}
                </span>
                <ChevronDown
                  className="w-4.5 h-4.5 text-blue-400 shrink-0 transition-transform duration-300"
                  style={{ transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    key={`answer-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                    style={{ overflow: "hidden" }}
                  >
                    <p className="px-6 pb-5 text-white/45 text-sm leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
