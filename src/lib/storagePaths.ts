/**
 * Rutas de archivos del almacén privado (vf-privado) que el panel devuelve para guardarlas.
 *
 * La subida siempre arma `<slug>/planilla/<nombre>`, pero la ruta vuelve del navegador: sin esta
 * revisión, un admin podía guardar la ruta de un comprobante de OTRO negocio y la app le devolvía
 * un enlace firmado para verlo. Vacío se acepta (comprobante opcional).
 */
const NAME_RE = /^[A-Za-z0-9._-]+$/;

export function isOwnPrivatePath(path: unknown, tenantSlug: string, folder: string): boolean {
  if (path === undefined || path === null || path === "") return true;
  if (typeof path !== "string") return false;
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === tenantSlug &&
    parts[1] === folder &&
    NAME_RE.test(parts[2]) &&
    parts[2] !== "." &&
    parts[2] !== ".."
  );
}
