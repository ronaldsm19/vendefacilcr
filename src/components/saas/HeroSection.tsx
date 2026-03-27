"use client";

import { motion } from "framer-motion";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: {
    duration: 0.7,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    delay,
  },
});

const WA_URL = `https://wa.me/50661266865?text=${encodeURIComponent("Hola! Quiero empezar con VendeFácil 🚀")}`;

export default function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#06060A] pt-24 pb-20 px-6"
    >
      {/* Glow orbs */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(147,51,234,0.06) 40%, transparent 70%)" }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 60%)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Eyebrow */}
        <motion.div {...fadeUp(0.05)} className="mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 text-xs font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Para emprendedores de Costa Rica
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          className="font-brand text-6xl sm:text-7xl md:text-8xl font-bold text-white leading-[1.05] tracking-tight mb-6"
          {...fadeUp(0.12)}
        >
          Tu negocio online
          <br />
          <span className="saas-accent-text">listo para vender.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10"
          {...fadeUp(0.22)}
        >
          Página web profesional, gestión de pedidos, inventario y finanzas —
          todo en un panel simple, desde el celular.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          {...fadeUp(0.32)}
        >
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full saas-accent-bg text-white font-semibold text-base hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-blue-500/25"
          >
            Quiero mi página →
          </a>
          <a
            href="#como-funciona"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-white/15 text-white/70 font-semibold text-base hover:border-white/30 hover:text-white transition-all duration-200"
          >
            Ver cómo funciona
          </a>
        </motion.div>

        {/* Trust line */}
        <motion.p
          className="text-sm text-white/25 mt-8 tracking-wide"
          {...fadeUp(0.42)}
        >
          ✓ Sin tarjeta de crédito &nbsp;·&nbsp; ✓ Configuración en 24h &nbsp;·&nbsp; ✓ Soporte en español
        </motion.p>

        {/* Dashboard preview */}
        <motion.div
          className="mt-16 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          <div className="rounded-2xl overflow-hidden saas-glow" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {/* Browser chrome */}
            <div className="bg-[#111118] h-9 flex items-center px-4 gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              <div className="ml-4 flex-1 h-5 rounded-md flex items-center px-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="text-[11px] text-white/25 font-mono">app.vendefacil.cr/admin</span>
              </div>
            </div>
            {/* Mock content */}
            <div className="bg-[#0D0D14] h-52 flex items-center justify-center px-8 gap-4">
              {[
                { v: "₡185,400", l: "Ingresos del mes",  c: "text-blue-400"   },
                { v: "23",       l: "Pedidos activos",    c: "text-purple-400" },
                { v: "8",        l: "Productos en stock", c: "text-emerald-400"},
              ].map((s, i) => (
                <div key={i} className="flex-1 rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                  <p className="text-[11px] text-white/35 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
