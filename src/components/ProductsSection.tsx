"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import { SeedProduct } from "@/data/seed";
import { orderCategories, type CategoryOrderEntry } from "@/lib/categories";
import { PRODUCTS_SECTION_FALLBACK, type ProductsSectionText } from "@/lib/storeTexts";

interface ProductsSectionProps {
  products: (SeedProduct & { _id?: string })[];
  whatsappNumber?: string;
  businessName?: string;
  categories?: CategoryOrderEntry[];
  /** Textos del encabezado, ya resueltos con productsSectionForDisplay (Configuración → Productos). */
  texts?: ProductsSectionText;
}

// Backward-compat display labels for old slug-based categories
const legacyLabels: Record<string, string> = {
  gelatina: "Gelatinas Mosaico",
  apretado: "Apretados Gourmet",
  especial: "Edición Especial",
};

function ProductsGrid({ products, whatsappNumber, businessName, categories: categoryOrder }: ProductsSectionProps) {
  const [activeCategory, setActiveCategory] = useState("all");

  // Derive tabs from actual product categories (handles both old slugs and new labels),
  // en el orden que configuró el admin — las que no están configuradas (o vienen de un slug
  // viejo) quedan al final, alfabéticas.
  const categories = (() => {
    const orderedKeys = orderCategories(categoryOrder ?? [], products.map((p) => p.category));
    const items = orderedKeys.map((key) => ({ key, label: legacyLabels[key] ?? key }));
    return [{ key: "all", label: "Todos" }, ...items];
  })();

  const filtered =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <>
      {/* ── Category tabs ── */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 border cursor-pointer ${
              activeCategory === cat.key
                ? "gradient-bg text-white border-transparent shadow-md"
                : "bg-surface text-brand-dark/60 border-brand-dark/10 hover:border-brand-pink/30 hover:text-brand-pink"
            }`}
          >
            {cat.label}
            <span
              className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                activeCategory === cat.key
                  ? "bg-white/20 text-white"
                  : "bg-surface-alt text-brand-dark/50"
              }`}
            >
              {cat.key === "all"
                ? products.length
                : products.filter((p) => p.category === cat.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      <motion.div
        key={activeCategory}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filtered.map((product, i) => (
          <ProductCard key={product._id ?? product.name} product={product} index={i} whatsappNumber={whatsappNumber} businessName={businessName} />
        ))}
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-brand-dark/40">
          <p className="text-4xl mb-3">🛒</p>
          <p className="font-semibold">No hay productos en esta categoría aún</p>
        </div>
      )}
    </>
  );
}

export default function ProductsSection({ products, whatsappNumber, businessName, categories, texts = PRODUCTS_SECTION_FALLBACK }: ProductsSectionProps) {
  return (
    <section id="productos" className="py-24 px-6 bg-surface-alt">
      <div className="max-w-6xl mx-auto">
        {/* ── Section heading ── */}
        <div className="text-center mb-14">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-sm font-semibold text-brand-pink uppercase tracking-widest mb-3"
          >
            {texts.eyebrow}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-brand text-4xl md:text-5xl font-bold text-brand-dark"
          >
            {texts.title}
            {texts.title && texts.highlight && " "}
            {texts.highlight && <span className="gradient-text">{texts.highlight}</span>}
          </motion.h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-4 mx-auto w-16 h-1 rounded-full gradient-bg"
          />
          {texts.badge && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35 }}
              className="flex flex-wrap justify-center gap-2 mt-5"
            >
              <span className="px-3 py-1.5 rounded-full bg-brand-pink/10 text-brand-pink border border-brand-pink/20 text-sm font-semibold">
                {texts.badge}
              </span>
            </motion.div>
          )}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-brand-dark/60 max-w-md mx-auto"
          >
            {texts.description}
          </motion.p>
        </div>

        <ProductsGrid products={products} whatsappNumber={whatsappNumber} businessName={businessName} categories={categories} />
      </div>
    </section>
  );
}
