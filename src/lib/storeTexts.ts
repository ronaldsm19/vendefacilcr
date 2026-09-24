// Textos de la sección de productos de la tienda pública (SiteSettings.productsSection). Cada negocio
// los escribe en Configuración → Productos; lo que deje vacío se muestra con el texto neutro de acá,
// que también sirve de ejemplo (placeholder) en el formulario.

export interface ProductsSectionText {
  /** Rótulo pequeño en mayúsculas sobre el título. */
  eyebrow: string;
  /** Título; se muestra seguido de `highlight`. */
  title: string;
  /** Parte final del título, en el color de la marca. */
  highlight: string;
  /** Frase debajo del título. */
  description: string;
  /** Etiqueta opcional (p. ej. "📦 Pedidos por encargo"); vacía no se muestra. */
  badge: string;
}

export const PRODUCTS_SECTION_LIMITS: Record<keyof ProductsSectionText, number> = {
  eyebrow: 40,
  title: 60,
  highlight: 40,
  description: 160,
  badge: 40,
};

/** Lo que ve la tienda cuando el negocio no escribió nada. La etiqueta queda oculta. */
export const PRODUCTS_SECTION_FALLBACK: ProductsSectionText = {
  eyebrow: "Nuestros productos",
  title: "Hecho con",
  highlight: "dedicación",
  description: "Seleccionados con cuidado para ti",
  badge: "",
};

export const EMPTY_PRODUCTS_SECTION: ProductsSectionText = {
  eyebrow: "", title: "", highlight: "", description: "", badge: "",
};

/** Normaliza lo guardado (o lo que llega del formulario): solo texto, recortado y con su largo máximo. */
export function readProductsSectionText(raw: unknown): ProductsSectionText {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...EMPTY_PRODUCTS_SECTION };
  for (const key of Object.keys(PRODUCTS_SECTION_LIMITS) as (keyof ProductsSectionText)[]) {
    const v = r[key];
    out[key] = typeof v === "string" ? v.trim().slice(0, PRODUCTS_SECTION_LIMITS[key]) : "";
  }
  return out;
}

/**
 * Textos a mostrar en la tienda. Si el negocio escribió el título o la parte destacada, se usan
 * juntos tal cual (aunque uno quede vacío), para no mezclar su título con el ejemplo neutro.
 */
export function productsSectionForDisplay(raw: unknown): ProductsSectionText {
  const t = readProductsSectionText(raw);
  const customTitle = t.title !== "" || t.highlight !== "";
  return {
    eyebrow: t.eyebrow || PRODUCTS_SECTION_FALLBACK.eyebrow,
    title: customTitle ? t.title : PRODUCTS_SECTION_FALLBACK.title,
    highlight: customTitle ? t.highlight : PRODUCTS_SECTION_FALLBACK.highlight,
    description: t.description || PRODUCTS_SECTION_FALLBACK.description,
    badge: t.badge,
  };
}
