/**
 * Rellena ProductClick.tenantId en los clicks viejos, que se guardaron sin tenant.
 *
 * Por qué hace falta: la ruta pública POST /api/products/[id]/click nunca guardaba el tenantId,
 * y el widget "Top productos clickeados" del dashboard filtra los clicks por tenantId — así que
 * para todos los tenants mostraba "Sin datos aún". La ruta ya guarda el tenant; este script
 * arregla los clicks que se registraron antes de ese arreglo.
 *
 * Cómo lo resuelve: cada click guarda el productId, y el producto sí sabe a qué tenant
 * pertenece. Por cada productId distinto entre los clicks sin tenant, busca el producto y le
 * pone su tenantId a todos esos clicks.
 *
 * Qué NO toca, a propósito:
 *   - Clicks cuyo producto ya no existe (borrado, o el id nunca fue válido — ahí caen los viejos
 *     "Producto desconocido"): no hay forma de saber de qué tenant eran. Solo se cuentan.
 *   - Clicks cuyo producto existe pero no tiene tenantId (producto legacy huérfano): tampoco
 *     hay tenant que ponerles. Solo se cuentan.
 *   - Clicks que ya tienen tenantId: ni se leen.
 *
 * Es idempotente: solo escribe en clicks con tenantId vacío, así que se puede correr varias veces.
 * Corrélo después de desplegar el arreglo de la ruta; si se corre antes, los clicks que entren
 * entre medio van a quedar sin tenant, y basta con volver a correrlo.
 *
 * Uso:
 *   node scripts/backfill-product-clicks-tenant.mjs
 *     -> modo reporte (no escribe nada), imprime qué haría, para TODOS los tenants.
 *   node scripts/backfill-product-clicks-tenant.mjs --apply
 *     -> aplica los cambios de verdad, para todos los tenants.
 *   ... TENANT_ID="<id de un tenant>" ...
 *     -> agregá esta variable (con o sin --apply) para limitar a un solo tenant — útil para
 *        probar en uno antes de correrlo contra todos. En este modo no se pueden contar los
 *        clicks de productos que ya no existen (no hay cómo saber de qué tenant eran).
 *
 * La cadena de conexión sale de MONGODB_URI; si no está definida, se lee de .env.local.
 *
 * Corré primero SIN --apply, revisá el resumen, y recién después con --apply.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
if (!process.env.MONGODB_URI) {
  try { process.loadEnvFile(new URL("../.env.local", import.meta.url)); } catch { /* sin .env.local */ }
}
const uri = process.env.MONGODB_URI;
const tenantId = process.env.TENANT_ID;

if (!uri) {
  console.error("Falta MONGODB_URI (ni en el entorno ni en .env.local). Ejemplo:\n  MONGODB_URI=\"...\" node scripts/backfill-product-clicks-tenant.mjs");
  process.exit(1);
}
if (tenantId && !mongoose.isObjectIdOrHexString(tenantId)) {
  console.error(`TENANT_ID inválido: "${tenantId}"`);
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;
const clicks = db.collection("productclicks");
const products = db.collection("products");

// { tenantId: null } calza tanto con el campo ausente como con null.
const ORPHAN = { tenantId: null };

// productIds distintos entre los clicks sin tenant. Con TENANT_ID, solo los de productos de ese tenant.
let productIds;
if (tenantId) {
  const tenantOid = new mongoose.Types.ObjectId(tenantId);
  const own = await products
    .find({ tenantId: { $in: [tenantOid, tenantId] } }, { projection: { _id: 1 } })
    .toArray();
  productIds = await clicks.distinct("productId", { ...ORPHAN, productId: { $in: own.map((p) => String(p._id)) } });
} else {
  productIds = await clicks.distinct("productId", ORPHAN);
}

// Clicks sin tenant por productId, en una sola consulta.
const counts = new Map(
  (await clicks.aggregate([
    { $match: { ...ORPHAN, productId: { $in: productIds } } },
    { $group: { _id: "$productId", n: { $sum: 1 } } },
  ]).toArray()).map((c) => [c._id, c.n])
);

const found = await products
  .find(
    { _id: { $in: productIds.filter((id) => mongoose.isObjectIdOrHexString(id)).map((id) => new mongoose.Types.ObjectId(id)) } },
    { projection: { tenantId: 1, name: 1 } }
  )
  .toArray();
const productById = new Map(found.map((p) => [String(p._id), p]));

// tenantId del producto como ObjectId (hay datos legacy con el tenantId guardado como string).
function toTenantOid(value) {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.isObjectIdOrHexString(value)) return new mongoose.Types.ObjectId(value);
  return null;
}

const ops = [];
const perTenant = new Map(); // tenantId -> { clicks, products }
let toUpdate = 0;
let missingProduct = 0;
let missingProductIds = 0;
let productWithoutTenant = 0;

for (const productId of productIds) {
  const n = counts.get(productId) ?? 0;
  const product = productById.get(productId);
  if (!product) { missingProduct += n; missingProductIds++; continue; }

  const tenantOid = toTenantOid(product.tenantId);
  if (!tenantOid) { productWithoutTenant += n; continue; }

  toUpdate += n;
  const key = String(tenantOid);
  const t = perTenant.get(key) ?? { clicks: 0, products: 0 };
  t.clicks += n;
  t.products++;
  perTenant.set(key, t);

  ops.push({ updateMany: { filter: { ...ORPHAN, productId }, update: { $set: { tenantId: tenantOid } } } });
}

console.log(`${APPLY ? "APLICANDO" : "MODO REPORTE (sin --apply, no se escribe nada)"} — ${productIds.length} producto(s) distinto(s) con clicks sin tenant${tenantId ? ` (solo tenant ${tenantId})` : ""}.\n`);

const tenantNames = new Map(
  (await db.collection("tenants")
    .find({ _id: { $in: [...perTenant.keys()].map((id) => new mongoose.Types.ObjectId(id)) } }, { projection: { slug: 1 } })
    .toArray()).map((t) => [String(t._id), t.slug])
);
for (const [id, t] of perTenant) {
  console.log(`  tenant ${tenantNames.get(id) ?? "(tenant no encontrado)"} [${id}]: ${t.clicks} click(s) en ${t.products} producto(s)`);
}

let updated = 0;
if (APPLY && ops.length > 0) {
  const res = await clicks.bulkWrite(ops, { ordered: false });
  updated = res.modifiedCount;
}

console.log("\n── Resumen ──────────────────────────────────────────");
console.log(`Clicks sin tenant con producto existente: ${toUpdate}${APPLY ? "" : " (se actualizarían)"}`);
if (tenantId) {
  console.log("Clicks de productos que ya no existen: no se pueden atribuir a un tenant con TENANT_ID; corrélo sin TENANT_ID para contarlos.");
} else {
  console.log(`Clicks de productos que ya no existen (quedan igual): ${missingProduct} en ${missingProductIds} productId(s)`);
}
console.log(`Clicks de productos sin tenantId (quedan igual): ${productWithoutTenant}`);
if (APPLY) {
  console.log(`Clicks actualizados: ${updated}`);
} else {
  console.log("\nNo se escribió nada (modo reporte). Para aplicar de verdad, agregá --apply.");
}

await mongoose.disconnect();
