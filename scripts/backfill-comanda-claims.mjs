/**
 * Rellena Sale.comandaClaims en ventas viejas (de antes de Fase 7) que vinieron de una mesa
 * pero nunca guardaron el detalle exacto de qué índice/cantidad de cada comanda cobraron.
 *
 * Por qué hace falta: al eliminar una venta, el borrado revierte el paidQty de las comandas
 * que esa venta pagó. Para ventas nuevas eso es exacto porque Sale.comandaClaims ya lo guarda
 * desde que se crea la venta. Para ventas viejas, comandaClaims está vacío y el borrado cae a
 * un estimado por producto — funciona, pero es aproximado.
 *
 * Qué migra y qué NO, a propósito:
 *   - Si una comanda fue cobrada por UNA sola venta en toda su historia (el caso normal: una
 *     mesa, una cuenta, un solo tiquete), el paidQty ACTUAL de esa comanda le pertenece por
 *     completo a esa venta — no hay ambigüedad, así que se rellena exacto.
 *   - Si una comanda fue cobrada por VARIAS ventas (cuenta dividida entre personas), no hay
 *     forma de saber con certeza cuánto le tocó a cada una sin haberlo guardado en su momento.
 *     Este script NO adivina para esos casos: los deja tal cual (comandaClaims vacío para esa
 *     comanda), y si alguna de esas ventas se llega a borrar, el endpoint de borrado sigue
 *     usando su propio estimado por producto — el mismo comportamiento de hoy, sin cambios.
 *
 * Es aditivo y sin riesgo: solo agrega detalle a un campo que ya existe y que hoy está vacío
 * en estas ventas; no toca montos, inventario, ni el estado de ninguna comanda.
 *
 * Uso:
 *   MONGODB_URI="<cadena de conexión>" node scripts/backfill-comanda-claims.mjs
 *     -> modo reporte (no escribe nada), imprime qué haría, para TODOS los tenants.
 *   MONGODB_URI="<cadena de conexión>" node scripts/backfill-comanda-claims.mjs --apply
 *     -> aplica los cambios de verdad, para todos los tenants.
 *   ... TENANT_ID="<id de un tenant>" ...
 *     -> agregá esta variable (con o sin --apply) para limitar a un solo tenant — útil para
 *        probar en uno antes de correrlo contra todos.
 *
 * Corré primero SIN --apply, revisá el resumen, y recién después con --apply.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const tenantId = process.env.TENANT_ID;

if (!uri) {
  console.error("Falta MONGODB_URI. Ejemplo:\n  MONGODB_URI=\"...\" node scripts/backfill-comanda-claims.mjs");
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const query = {
  comandaIds: { $exists: true, $ne: [] },
  $or: [{ comandaClaims: { $exists: false } }, { comandaClaims: { $size: 0 } }],
};
if (tenantId) query.tenantId = new mongoose.Types.ObjectId(tenantId);

const sales = await db.collection("sales").find(query).toArray();

console.log(`${APPLY ? "APLICANDO" : "MODO REPORTE (sin --apply, no se escribe nada)"} — ${sales.length} venta(s) candidata(s).\n`);

let exactCount = 0;      // ventas donde TODAS sus comandas se pudieron reconstruir exacto
let partialCount = 0;    // ventas donde ALGUNAS comandas sí y otras no (ambiguas)
let noneCount = 0;       // ventas donde NINGUNA comanda se pudo reconstruir
let writes = 0;

// Cache de comandas ya leídas, por si varias ventas comparten la misma.
const comandaCache = new Map();
async function getComanda(id) {
  const key = String(id);
  if (!comandaCache.has(key)) {
    comandaCache.set(key, await db.collection("comandas").findOne({ _id: new mongoose.Types.ObjectId(key) }));
  }
  return comandaCache.get(key);
}

for (const sale of sales) {
  const claims = [];
  let ambiguous = 0;

  for (const comandaId of sale.comandaIds) {
    const comanda = await getComanda(comandaId);
    if (!comanda) { ambiguous++; continue; } // comanda borrada o inválida: no hay nada que reconstruir

    const claimedBy = (comanda.saleIds ?? []).map(String);
    const onlyThisSale = claimedBy.length === 1 && claimedBy[0] === String(sale._id);
    if (!onlyThisSale) { ambiguous++; continue; } // cuenta dividida entre varias ventas: no se adivina

    const items = (comanda.items ?? [])
      .map((item, index) => ({ index, qty: item.paidQty ?? 0 }))
      .filter((it) => it.qty > 0);
    if (items.length === 0) { ambiguous++; continue; }

    claims.push({ comandaId: String(comandaId), items });
  }

  if (claims.length === 0) {
    noneCount++;
    continue;
  }
  if (ambiguous > 0) partialCount++; else exactCount++;

  console.log(
    `  venta ${sale._id} (tiquete #${sale.ticketNumber ?? "-"}): ` +
    `${claims.length} comanda(s) exacta(s)${ambiguous > 0 ? `, ${ambiguous} ambigua(s) sin tocar` : ""}`
  );

  if (APPLY) {
    await db.collection("sales").updateOne({ _id: sale._id }, { $set: { comandaClaims: claims } });
    writes++;
  }
}

console.log("\n── Resumen ──────────────────────────────────────────");
console.log(`Ventas candidatas revisadas: ${sales.length}`);
console.log(`  Reconstrucción completa (todas sus comandas):  ${exactCount}`);
console.log(`  Reconstrucción parcial (mezcla de exactas y ambiguas): ${partialCount}`);
console.log(`  Sin nada que reconstruir (quedan igual que hoy): ${noneCount}`);
if (APPLY) {
  console.log(`Ventas actualizadas: ${writes}`);
} else {
  console.log("\nNo se escribió nada (modo reporte). Para aplicar de verdad, agregá --apply.");
}

await mongoose.disconnect();
