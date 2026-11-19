// Prueba: `node --experimental-transform-types src/lib/openPrice.test.ts` (Node 22.7+; usa transform porque carga módulos del servidor).
// Productos de precio libre (pulseras, artesanías): el precio de cada pieza lo escribe el cajero y el
// servidor lo acepta solo en esos productos. Sin base de datos: el catálogo se simula. También que los
// productos de precio fijo y por kilo sigan validándose igual que antes.
import { register } from 'node:module';

const hook = `
const SRC = ${JSON.stringify(new URL('../', import.meta.url).href)};
export async function resolve(specifier, context, next) {
  let s = specifier;
  if (s.startsWith('@/')) s = SRC + s.slice(2);
  const local = s.startsWith(SRC) || ((s.startsWith('./') || s.startsWith('../')) && context.parentURL && context.parentURL.startsWith(SRC));
  if (local && !/\\.[a-z]+$/i.test(s)) {
    try { return await next(s + '.ts', context); } catch { return next(s + '/index.ts', context); }
  }
  return next(s, context);
}`;
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);

const soldBy = await import('./soldBy.ts');
const saleItems = await import('../server/services/saleItems.ts');
const comandaItems = await import('../server/services/comandaItems.ts');
const { Product } = await import('../models/Product.ts');

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}
async function rejects(label: string, fn: () => Promise<unknown>, status?: number) {
  try { await fn(); eq(label, 'no lanzó', 'lanza'); }
  catch (e) { eq(label, status ? (e as { status?: number }).status : 'lanza', status ?? 'lanza'); }
}
function throws(label: string, fn: () => unknown) {
  try { fn(); eq(label, 'no lanzó', 'lanza'); } catch { eq(label, 'lanza', 'lanza'); }
}

// ── Tipo de venta y precios escritos a mano ─────────────────────────
eq('precio libre es un modo válido', soldBy.isSoldBy('libre'), true);
eq('un modo inventado no', soldBy.isSoldBy('docena'), false);
eq('etiqueta en catálogos', soldBy.catalogPriceLabel(3000, 'libre'), 'Precio libre');
eq('etiqueta por kilo igual que antes', soldBy.catalogPriceLabel(12000, 'kg'), `₡${(12000).toLocaleString('es-CR')}/kg`);
eq('lee "4500"', soldBy.parseOpenPrice('4500'), 4500);
eq('lee "4 500" y "₡4.500"', [soldBy.parseOpenPrice('4 500'), soldBy.parseOpenPrice('₡4.500')], [4500, 4500]);
eq('cero no es precio', soldBy.parseOpenPrice('0'), null);
eq('letras no', soldBy.parseOpenPrice('cuatro mil'), null);
eq('más del tope es error de digitación', soldBy.parseOpenPrice('50000000'), null);
eq('desde afuera: entero positivo', soldBy.normalizeOpenPrice(4500), 4500);
eq('desde afuera: sin precio', soldBy.normalizeOpenPrice(undefined), undefined);
eq('desde afuera: decimales o negativos no', [soldBy.normalizeOpenPrice(4500.5), soldBy.normalizeOpenPrice(-1), soldBy.normalizeOpenPrice('4500')], [null, null, null]);

// ── Venta: el servidor revisa contra el catálogo ────────────────────
const catalog = [
  { _id: 'p1', name: 'Pulseras', price: 0, soldBy: 'libre', extras: [] },
  { _id: 'p2', name: 'Café', price: 1000, soldBy: 'unidad', extras: [] },
  { _id: 'p3', name: 'Terbi', price: 14000, soldBy: 'kg', extras: [] },
];
(Product as unknown as { find: unknown }).find = () => ({ select: () => ({ lean: async () => catalog }) });
// ids de prueba con forma de ObjectId (24 hexadecimales)
const P1 = '64b0000000000000000000a1', P2 = '64b0000000000000000000a2', P3 = '64b0000000000000000000a3';
catalog[0]._id = P1; catalog[1]._id = P2; catalog[2]._id = P3;
const line = (productId: string, unitPrice: number, extra: Record<string, unknown> = {}) =>
  ({ productId, productName: 'x', unitPrice, quantity: 1, extras: [], lineTotal: 0, ...extra });

const okSale = await saleItems.checkCatalogPrices('t', [line(P1, 4500), line(P1, 7000), line(P2, 1000)]);
eq('pulseras a ₡4 500 y ₡7 000 entran con su precio', okSale.map((l) => [l.productName, l.unitPrice, l.lineTotal]), [['Pulseras', 4500, 4500], ['Pulseras', 7000, 7000], ['Café', 1000, 1000]]);
await rejects('precio libre en 0 no se cobra', () => saleItems.checkCatalogPrices('t', [line(P1, 0)]), 400);
await rejects('precio libre con decimales no', () => saleItems.checkCatalogPrices('t', [line(P1, 4500.5)]), 400);
await rejects('el café sigue exigiendo su precio de catálogo', () => saleItems.checkCatalogPrices('t', [line(P2, 500)]), 409);
await rejects('el queso por kilo sigue exigiendo el peso', () => saleItems.checkCatalogPrices('t', [line(P3, 14000)]), 409);
const kg = await saleItems.checkCatalogPrices('t', [line(P3, 14000, { weightKg: 0.25 })]);
eq('el queso por kilo igual que antes', kg[0].lineTotal, 3500);
eq('dos pulseras a distinto precio son líneas distintas', saleItems.saleLineKey(line(P1, 4500)) !== saleItems.saleLineKey(line(P1, 7000)), true);

// ── Comanda: forma de los ítems ─────────────────────────────────────
const oid = '64b000000000000000000001';
comandaItems.validateComandaItemsInput([{ productId: oid, quantity: 1, unitPrice: 4500 }]);
eq('comanda con precio de la pieza: forma válida', true, true);
throws('comanda con precio 0', () => comandaItems.validateComandaItemsInput([{ productId: oid, quantity: 1, unitPrice: 0 }]));
throws('comanda con precio en texto', () => comandaItems.validateComandaItemsInput([{ productId: oid, quantity: 1, unitPrice: '4500' }]));
comandaItems.validateComandaItemsInput([{ productId: oid, quantity: 2 }]);
eq('comanda sin precio (lo de siempre): forma válida', true, true);

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log('\nTodo bien');
