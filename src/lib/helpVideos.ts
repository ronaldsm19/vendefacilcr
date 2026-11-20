/**
 * Videos de ayuda: los carga el superadmin (un enlace de YouTube por video) y los negocios los ven
 * en el panel, en el botón "Ayuda" de cada pantalla y en la página de ayuda. Sin dependencias: lo
 * usan el modelo, las rutas y las pantallas.
 */

/**
 * Dónde sale cada video. Las claves que son secciones del panel ("pos", "productos"...) coinciden
 * con el primer segmento de la ruta (/<negocio>/admin/<sección>): así el botón "Ayuda" de esa
 * pantalla muestra primero sus videos. "general" y "novedades" no son pantallas: salen en Inicio y
 * en la página de ayuda.
 */
export const HELP_SECTIONS = [
  { key: "general", label: "Primeros pasos" },
  { key: "novedades", label: "Novedades" },
  { key: "pos", label: "Punto de venta" },
  { key: "cierre-de-caja", label: "Caja" },
  { key: "salon", label: "Salón" },
  { key: "comandas", label: "Comandas" },
  { key: "pedidos", label: "Pedidos y ventas" },
  { key: "clientes", label: "Clientes" },
  { key: "productos", label: "Productos" },
  { key: "inventario", label: "Inventario" },
  { key: "materiales", label: "Materiales" },
  { key: "recetas", label: "Recetas" },
  { key: "finanzas", label: "Finanzas" },
  { key: "gastos", label: "Gastos" },
  { key: "usuarios", label: "Usuarios" },
  { key: "jornada", label: "Jornada laboral" },
  { key: "planilla", label: "Planilla" },
  { key: "configuracion", label: "Configuración" },
  { key: "mensualidad", label: "Mensualidad" },
  { key: "perfil", label: "Perfil" },
] as const;

export type HelpSection = (typeof HELP_SECTIONS)[number]["key"];

/** Las que no son una pantalla del panel: las ve todo el personal. */
export const OPEN_HELP_SECTIONS: HelpSection[] = ["general", "novedades"];

export const HELP_LIMITS = { title: 100, description: 300, order: 9999 };

export function isHelpSection(value: unknown): value is HelpSection {
  return HELP_SECTIONS.some((s) => s.key === value);
}

export function helpSectionLabel(key: string): string {
  return HELP_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

/** Posición de la sección en la lista de arriba, para ordenar la página de ayuda. */
export function helpSectionRank(key: string): number {
  const i = HELP_SECTIONS.findIndex((s) => s.key === key);
  return i < 0 ? HELP_SECTIONS.length : i;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * El id del video a partir de lo que se pegue: el enlace de compartir (youtu.be/ID), el de la página
 * (youtube.com/watch?v=ID), uno de Shorts, uno para insertar, o el id solo. null si no es de YouTube.
 */
export function youtubeId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
  }
  return id && ID_RE.test(id) ? id : null;
}

/** Para ver el video dentro del panel: sin cookies de YouTube hasta que la persona le da play. */
export function youtubeEmbedUrl(id: string, autoplay = true): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${autoplay ? "&autoplay=1" : ""}`;
}

export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Busca sin tildes ni mayúsculas: "cobrar" encuentra "Cómo cobrar". */
export function helpSearchKey(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
