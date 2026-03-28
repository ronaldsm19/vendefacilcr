"use client";

import { motion } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import { SeedProduct } from "@/data/seed";

interface BestSellersSectionProps {
  products: (SeedProduct & { _id?: string })[];
  whatsappNumber?: string;
}

export default function BestSellersSection({ products, whatsappNumber }: BestSellersSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-sm font-semibold text-brand-pink uppercase tracking-widest mb-3"
          >
            Lo que más piden
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-brand text-4xl md:text-5xl font-bold text-brand-dark"
          >
            🔥 <span className="gradient-text">Más vendidos</span>
          </motion.h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-4 mx-auto w-16 h-1 rounded-full gradient-bg"
          />
        </div>

        {/* Cards — horizontal scroll mobile, 3-col grid desktop */}
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0 scrollbar-hide">
          {products.slice(0, 3).map((product, i) => (
            <div
              key={product._id ?? product.name}
              className="min-w-[280px] md:min-w-0 snap-start"
            >
              <ProductCard product={product} index={i} whatsappNumber={whatsappNumber} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
