"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Package, ShoppingBag, Receipt, TrendingUp, Settings, Warehouse } from "lucide-react";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",     active: false },
  { icon: Package,         label: "Productos",     active: false },
  { icon: Warehouse,       label: "Inventario",    active: false },
  { icon: ShoppingBag,     label: "Pedidos",       active: true  },
  { icon: Receipt,         label: "Gastos",        active: false },
  { icon: TrendingUp,      label: "Finanzas",      active: false },
  { icon: Settings,        label: "Configuración", active: false },
];

const STATS = [
  { label: "Ingresos",  value: "₡185,400", color: "text-emerald-400" },
  { label: "Pedidos",   value: "23",        color: "text-blue-400"   },
  { label: "Productos", value: "8",         color: "text-purple-400" },
];

const ORDERS = [
  { name: "María G.",  product: "Cajeta artesanal",  total: "₡12,500", paid: true  },
  { name: "Carlos M.", product: "Gelatina mosaico",  total: "₡8,900",  paid: false },
  { name: "Ana P.",    product: "Tamales navideños", total: "₡21,000", paid: true  },
  { name: "Luis R.",   product: "Empanadas ×6",      total: "₡6,500",  paid: false },
];

export default function AdminPreviewSection() {
  return (
    <section
      id="preview"
      style={{ scrollMarginTop: "80px" }}
      className="py-28 px-6 bg-[#06060A] relative overflow-hidden"
    >
      {/* Ambient glow behind mockup */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.08) 0%, transparent 60%)" }}
      />

      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <motion.span
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 block mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ver por dentro
          </motion.span>
          <motion.h2
            className="font-brand text-4xl md:text-5xl font-bold text-white leading-tight mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            Tu panel de{" "}
            <span className="saas-accent-text">administración</span>
          </motion.h2>
          <motion.p
            className="text-white/45"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.14 }}
          >
            Todo lo que necesitás para gestionar tu negocio, desde el celular.
          </motion.p>
        </div>

        {/* Browser mockup */}
        <motion.div
          className="max-w-5xl mx-auto rounded-2xl overflow-hidden saas-glow"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          {/* Chrome */}
          <div
            className="h-10 flex items-center px-4 gap-2"
            style={{ background: "#111118", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            <div
              className="ml-4 flex-1 h-5 rounded-md flex items-center px-3"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <span className="text-[11px] text-white/25 font-mono">app.vendefacil.cr/admin/pedidos</span>
            </div>
          </div>

          {/* Body */}
          <div className="flex min-h-[480px] overflow-x-auto">
            {/* Sidebar */}
            <aside
              className="w-48 flex-col shrink-0 hidden md:flex"
              style={{ background: "#0A0A10", borderRight: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-brand text-sm font-bold saas-accent-text">VendeFácil</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Panel de administración</p>
              </div>
              <nav className="px-3 py-3 space-y-0.5 flex-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                        item.active
                          ? "saas-accent-bg text-white"
                          : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {item.label}
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* Content */}
            <main className="flex-1 p-5 min-w-[360px]" style={{ background: "#0D0D14" }}>
              <h2 className="font-semibold text-white/80 text-sm mb-5">Pedidos del mes</h2>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {STATS.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div
                  className="grid grid-cols-4 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
                >
                  <span>Cliente</span>
                  <span>Producto</span>
                  <span>Total</span>
                  <span>Estado</span>
                </div>
                {ORDERS.map((o, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-4 px-4 py-3 text-xs items-center"
                    style={{
                      borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    }}
                  >
                    <span className="font-medium text-white/80">{o.name}</span>
                    <span className="text-white/40 truncate pr-2">{o.product}</span>
                    <span className="font-semibold text-white/70">{o.total}</span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${
                        o.paid ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500/15 text-orange-400"
                      }`}
                    >
                      {o.paid ? "Pagado" : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            </main>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
