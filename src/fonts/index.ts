import localFont from "next/font/local";

// Letras de VendeFácil (superadmin y landing) como archivos locales: el build no depende de bajarlas de
// Google. Se definen una sola vez acá y se importan donde hagan falta.
// Sin el respaldo automático de Next (una Arial ajustada que se mete justo después de cada fuente):
// trae el signo de colón y le ganaría a la variante extendida de más abajo.
export const vfSans = localFont({
  src: "./geist-latin-wght.woff2",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-sa-sans",
});

export const vfDisplay = localFont({
  src: "./familjen-grotesk-latin-wght.woff2",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-sa-display",
});

// El signo de colón (₡) no viene en los archivos de arriba: sale de la variante extendida de la letra de
// títulos, que se baja solo cuando hace falta.
export const vfDisplayExt = localFont({
  src: "./familjen-grotesk-latin-ext-wght.woff2",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
  variable: "--font-sa-display-ext",
});

/** Clases que publican las tres variables de fuente en el elemento que las lleve. */
export const vfFontVars = `${vfSans.variable} ${vfDisplay.variable} ${vfDisplayExt.variable}`;
