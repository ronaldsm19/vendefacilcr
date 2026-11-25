/**
 * Limpia el cuerpo de una petición antes de pasarlo a un findOneAndUpdate.
 *
 * Mongoose acepta operadores en la actualización: un cuerpo como {"$set": {"tenantId": "<otro>"}}
 * pasaba de largo un `delete body.tenantId` y mudaba el documento a otro negocio. Acá se quitan
 * todas las llaves que empiezan con "$" (o traen puntos, que apuntan a subcampos) y los campos
 * que nunca se cambian desde el panel. Los modelos además marcan tenantId como inmutable.
 */
const PROTECTED = new Set(["tenantId", "_id", "__v", "createdAt", "updatedAt"]);

// Los valores siguen sin tipo, igual que lo que devuelve request.json(): cada ruta valida los suyos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;

export function safeUpdate(body: unknown, extraProtected: string[] = []): Body {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const blocked = new Set([...PROTECTED, ...extraProtected]);
  const out: Body = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".") || blocked.has(key)) continue;
    out[key] = value;
  }
  return out;
}
