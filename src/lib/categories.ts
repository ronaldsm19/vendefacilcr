/**
 * Reordena las categorías que ya tienen productos según el orden que configuró el admin en
 * Configuración → Familias de productos. No agrega categorías sin productos ni las quita —
 * eso lo sigue decidiendo cada pantalla como hasta ahora — solo cambia el ORDEN de las que ya
 * iban a aparecer.
 *
 * Product.category es texto libre, no una referencia a Category: puede haber categorías en
 * productos que no estén en la colección configurada (alguien la escribió a mano). Esas van
 * al final, en orden alfabético, para que nunca desaparezcan de los filtros.
 */

export interface CategoryOrderEntry {
  label: string;
  order: number;
}

export function orderCategories(
  configured: CategoryOrderEntry[],
  productCategories: Iterable<string | null | undefined>
): string[] {
  const present = new Set<string>();
  for (const c of productCategories) {
    if (c) present.add(c);
  }

  const configuredSorted = [...configured].sort(
    (a, b) => a.order - b.order || a.label.localeCompare(b.label)
  );

  const ordered: string[] = [];
  for (const c of configuredSorted) {
    if (present.has(c.label)) {
      ordered.push(c.label);
      present.delete(c.label);
    }
  }

  const unconfigured = Array.from(present).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...unconfigured];
}
