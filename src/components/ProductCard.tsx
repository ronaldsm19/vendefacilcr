"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ProductModal from "@/components/ProductModal";
import ProductImageCarousel from "@/components/ProductImageCarousel";
import { SeedProduct } from "@/data/seed";
import { Eye } from "lucide-react";

interface ProductCardProps {
  product: SeedProduct & { _id?: string };
  index?: number;
  whatsappNumber?: string;
}

// Backward-compat map for old slug-based categories
const legacyCategoryLabels: Record<string, { label: string; color: string }> = {
  gelatina: { label: "Gelatina Mosaico", color: "bg-brand-pink/90 text-white" },
  apretado: { label: "Apretado Gourmet", color: "bg-brand-orange/90 text-white" },
  especial: { label: "Edición Especial", color: "bg-brand-yellow/90 text-brand-dark" },
};

function trackClick(productId?: string) {
  if (!productId) return;
  // fire-and-forget — no bloquea la UI
  fetch(`/api/products/${productId}/click`, { method: "POST" }).catch(() => {});
}

export default function ProductCard({ product, index = 0, whatsappNumber }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const cat = legacyCategoryLabels[product.category] ?? {
    label: product.category,
    color: "bg-brand-dark/70 text-white",
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{
          duration: 0.6,
          delay: index * 0.1,
          ease: [0.22, 1, 0.36, 1],
        }}
        whileHover={{ y: -6 }}
        className="group relative bg-white rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-shadow duration-300 cursor-pointer flex flex-col"
        onClick={() => { setIsModalOpen(true); trackClick(product._id); }}
      >
        {/* ── Image ── */}
        <div className="relative h-52 overflow-hidden">
          <ProductImageCarousel
            images={[product.image, ...(product.images ?? [])]}
            alt={product.name}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* Category badge */}
          <span
            className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold z-10 ${cat.color}`}
          >
            {cat.label}
          </span>

          {/* Delivery badge */}
          <span
            className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold z-10 ${
              product.delivery
                ? "bg-emerald-500/90 text-white"
                : "bg-brand-dark/60 text-white/80"
            }`}
          >
            {product.delivery ? "🚗 Con envío" : "🏪 Retiro"}
          </span>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-brand-dark/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-2 text-white"
            >
              <Eye className="w-8 h-8" />
              <span className="text-sm font-semibold">Ver detalles</span>
            </motion.div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-5 flex flex-col flex-1 gap-3">
          <div>
            <h3 className="font-brand text-lg font-bold text-brand-dark leading-tight group-hover:gradient-text transition-all duration-300">
              {product.name}
            </h3>
            <p className="text-sm text-brand-dark/60 line-clamp-2 mt-1 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Toppings preview */}
          {product.toppings.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.toppings.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-0.5 rounded-full bg-brand-muted text-brand-dark/60 border border-brand-pink/10"
                >
                  {t}
                </span>
              ))}
              {product.toppings.length > 3 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-muted text-brand-pink/70">
                  +{product.toppings.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-brand-muted">
            <span className="text-xl font-bold gradient-text font-brand">
              ₡{product.price.toLocaleString("es-CR")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
            >
              Ver más
            </Button>
          </div>
        </div>
      </motion.article>

      <ProductModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        whatsappNumber={whatsappNumber}
      />
    </>
  );
}
