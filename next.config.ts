import type { NextConfig } from "next";

// Cabeceras de seguridad para todo el sitio:
// - frame-ancestors / X-Frame-Options: nadie puede meter el panel dentro de un iframe en otra
//   página para engañar a la persona y hacerla tocar botones (clickjacking).
// - nosniff: el navegador no "adivina" que una imagen es HTML o script.
// - Referrer-Policy: las rutas internas (con el slug y el id de lo que se mira) no viajan a otros sitios.
// No se pone una CSP completa a propósito: el sitio carga scripts y estilos que habría que inventariar antes.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
