/**
 * Secciones del negocio: agrupan categorías en "líneas" que el cliente ve separadas (por ejemplo
 * "Cafetería" y "Tienda de quesos") sin dejar de compartir un solo punto de venta, una sola caja y
 * unas solas finanzas. Cada negocio crea las suyas en Configuración → Productos; un negocio sin
 * secciones se ve exactamente igual que antes, en todas las pantallas.
 *
 * Una categoría pertenece a una sección por `Category.sectionId`. Un producto hereda la sección de
 * su categoría (Product.category guarda el nombre, no el id). Lo que no tiene sección asignada cae
 * en "Otros", que solo aparece cuando hay algo adentro.
 */

export interface BusinessSection {
  id: string;
  name: string;
}

export const MAX_SECTIONS = 6;
export const MAX_SECTION_NAME = 30;
/** Id de la sección implícita para lo que no tiene sección asignada. */
export const OTHER_SECTION_ID = "otros";
export const OTHER_SECTION_NAME = "Otros";

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

export function isSectionId(v: unknown): v is string {
  return typeof v === "string" && OBJECT_ID_RE.test(v);
}

/** Lee lo que venga de la base (o de una respuesta) y devuelve solo secciones válidas, en orden. */
export function readSections(raw: unknown): BusinessSection[] {
  if (!Array.isArray(raw)) return [];
  const out: BusinessSection[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const rec = s as Record<string, unknown>;
    const id = rec.id ?? rec._id;
    const idStr = id == null ? "" : String(id);
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (isSectionId(idStr) && name) out.push({ id: idStr, name });
  }
  return out;
}

export interface CategorySectionEntry {
  label: string;
  sectionId?: string | null;
}

/**
 * Mapa nombre de categoría → id de sección, ignorando las asignaciones a secciones que ya no
 * existen (se borró la sección y la categoría quedó apuntando a un id viejo).
 */
export function categorySectionMap(
  sections: BusinessSection[],
  categories: CategorySectionEntry[]
): Map<string, string> {
  const valid = new Set(sections.map((s) => s.id));
  const map = new Map<string, string>();
  for (const c of categories) {
    if (c.sectionId && valid.has(c.sectionId)) map.set(c.label, c.sectionId);
  }
  return map;
}

/** Sección de un producto según su categoría; "otros" si la categoría no tiene sección. */
export function sectionOfCategory(map: Map<string, string>, category: string | null | undefined): string {
  return (category && map.get(category)) || OTHER_SECTION_ID;
}

/**
 * Secciones que de verdad tienen algo, en el orden configurado, con "Otros" al final si hace
 * falta. `usedIds` son las secciones de los productos que se van a mostrar.
 */
export function visibleSections(sections: BusinessSection[], usedIds: Iterable<string>): BusinessSection[] {
  const used = new Set(usedIds);
  const list = sections.filter((s) => used.has(s.id));
  if (used.has(OTHER_SECTION_ID)) list.push({ id: OTHER_SECTION_ID, name: OTHER_SECTION_NAME });
  return list;
}

export interface SectionTotal {
  sectionId: string;
  name: string;
  revenue: number;
  units: number;
}

/** Nombre que se muestra para un id de sección (incluye "Otros"). */
export function sectionName(sections: BusinessSection[], id: string): string {
  if (id === OTHER_SECTION_ID) return OTHER_SECTION_NAME;
  return sections.find((s) => s.id === id)?.name ?? OTHER_SECTION_NAME;
}

/**
 * Suma líneas vendidas por sección. Devuelve todas las secciones configuradas (aunque estén en 0,
 * para que el dueño vea que no vendió nada en una) y "Otros" solo si tiene ventas.
 */
export function totalsBySection(
  sections: BusinessSection[],
  lines: { sectionId: string; revenue: number; units: number }[]
): SectionTotal[] {
  const acc = new Map<string, { revenue: number; units: number }>();
  for (const l of lines) {
    const known = l.sectionId === OTHER_SECTION_ID || sections.some((s) => s.id === l.sectionId);
    const key = known ? l.sectionId : OTHER_SECTION_ID;
    const cur = acc.get(key) ?? { revenue: 0, units: 0 };
    cur.revenue += l.revenue;
    cur.units += l.units;
    acc.set(key, cur);
  }
  const out: SectionTotal[] = sections.map((s) => ({
    sectionId: s.id,
    name: s.name,
    revenue: acc.get(s.id)?.revenue ?? 0,
    units: acc.get(s.id)?.units ?? 0,
  }));
  const other = acc.get(OTHER_SECTION_ID);
  if (other && (other.revenue !== 0 || other.units !== 0)) {
    out.push({ sectionId: OTHER_SECTION_ID, name: OTHER_SECTION_NAME, ...other });
  }
  return out;
}
