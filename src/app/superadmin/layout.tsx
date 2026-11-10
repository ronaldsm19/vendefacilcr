import localFont from "next/font/local";
import SuperadminShell from "@/components/superadmin/SuperadminShell";
import "./superadmin.css";

// Fuentes del superadmin como archivos locales: el build no depende de bajarlas de Google.
// Sin el respaldo automático de Next (una Arial ajustada que se mete justo después de cada fuente):
// trae el signo de colón y le ganaría a la variante extendida de más abajo.
const sans = localFont({
  src: "../../fonts/geist-latin-wght.woff2",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-sa-sans",
});
const display = localFont({
  src: "../../fonts/familjen-grotesk-latin-wght.woff2",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-sa-display",
});

// El signo de colón (₡) no viene en los archivos de arriba: sale de la variante extendida de la letra de
// títulos, que se baja solo cuando hace falta.
const displayExt = localFont({
  src: "../../fonts/familjen-grotesk-latin-ext-wght.woff2",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
  variable: "--font-sa-display-ext",
});

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`sa ${sans.variable} ${display.variable} ${displayExt.variable}`}>
      <SuperadminShell>{children}</SuperadminShell>
    </div>
  );
}
