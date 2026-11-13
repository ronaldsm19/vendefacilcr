/**
 * Dirección pública del sitio, sin protocolo: de acá cuelga la tienda de cada negocio
 * (`<host>/<slug>`). Sale de NEXT_PUBLIC_SITE_URL, así que al pasar al dominio propio basta con
 * cambiar esa variable.
 */
export function siteHost(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vendefacilcr.vercel.app")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}
