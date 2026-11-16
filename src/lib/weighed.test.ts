// Prueba: `node --experimental-transform-types src/lib/weighed.test.ts` (Node 22.7+; usa transform y no solo strip porque carga módulos del servidor).
// Productos por kilo de punta a punta, sin base de datos: precio de la pieza, validación de las
// líneas de venta y de comanda, tiquete, comanda impresa y lo que recibe el agente. También que las
// líneas de precio fijo (lo que ya usan todos los negocios) den exactamente lo mismo que antes.
import { register } from 'node:module';

// Los módulos de la app importan con "@/..." y sin extensión: se resuelven a src/ y a .ts.
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

const pricing = await import('./pricing.ts');
const soldBy = await import('./soldBy.ts');
const { kitchenNote } = await import('./kitchenText.ts');
const ticket = await import('./ticket.ts');
const { buildSalePayload } = await import('./printBridge.ts');
const saleItems = await import('../server/services/saleItems.ts');

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}
function throws(label: string, fn: () => unknown, code?: string) {
  try { fn(); eq(label, 'no lanzó', 'lanza'); }
  catch (e) { eq(label, code ? (e as { code?: string }).code : 'lanza', code ?? 'lanza'); }
}

// es-CR separa los miles con un espacio duro (U+00A0), igual que el resto de los tiquetes.
const DETAIL = `0,350 kg × ₡${(12000).toLocaleString('es-CR')}/kg`;

// ── Precio de la pieza ──────────────────────────────────────────────
const queso = { unitPrice: 12000, quantity: 1, weightKg: 0.35 };
eq('pieza de 0,350 kg a ₡12 000/kg', pricing.lineTotal(queso), 4200);
eq('precio base de la pieza', pricing.baseUnitPrice(queso), 4200);
eq('redondea a colones: 0,333 kg × ₡9 990', pricing.lineTotal({ unitPrice: 9990, quantity: 1, weightKg: 0.333 }), 3327);
eq('dos piezas iguales', pricing.lineTotal({ ...queso, quantity: 2 }), 8400);
eq('extras se suman por pieza', pricing.lineTotal({ ...queso, quantity: 2, extras: [{ name: 'Rallado', price: 300 }] }), 9000);
eq('subtotal mezclado', pricing.subtotalOf([queso, { unitPrice: 1500, quantity: 2 }]), 7200);

// Lo de siempre no cambia: sin peso, todo igual que antes.
eq('precio fijo igual que antes', pricing.lineTotal({ unitPrice: 1500, quantity: 3 }), 4500);
eq('precio fijo con extras igual que antes', pricing.lineTotal({ unitPrice: 2000, quantity: 2, extras: [{ name: 'Queso', price: 500, qty: 2 }] }), 6000);
eq('peso 0 cuenta como sin peso', pricing.baseUnitPrice({ unitPrice: 1500, weightKg: 0 }), 1500);
eq('oferta por volumen igual que antes', pricing.offerLineTotal({ unitPrice: 1000, quantity: 4 }, [{ qty: 4, price: 3500 }]), 3500);

// ── Peso que llega de afuera ────────────────────────────────────────
eq('peso válido', soldBy.normalizeWeightKg(0.35), 0.35);
eq('se redondea a gramos', soldBy.normalizeWeightKg(0.3456), 0.346);
eq('sin peso', soldBy.normalizeWeightKg(undefined), undefined);
eq('null = sin peso', soldBy.normalizeWeightKg(null), undefined);
eq('cero no vale', soldBy.normalizeWeightKg(0), null);
eq('negativo no vale', soldBy.normalizeWeightKg(-1), null);
eq('texto no vale', soldBy.normalizeWeightKg('0.35'), null);
eq('demasiado no vale', soldBy.normalizeWeightKg(1000), null);
eq('menos de un gramo no vale', soldBy.normalizeWeightKg(0.0004), null);
eq('peso escrito con coma', soldBy.parseKg('0,350'), 0.35);
eq('peso escrito con punto', soldBy.parseKg('1.2'), 1.2);
eq('peso con 4 decimales no', soldBy.parseKg('0,3501'), null);
eq('stock de una pieza pesada (kg)', soldBy.stockUnits({ quantity: 2, weightKg: 0.35 }), 0.7);
eq('stock de precio fijo (unidades)', soldBy.stockUnits({ quantity: 3 }), 3);
eq('nombre con peso', soldBy.weighedName('Queso suizo', 0.35), 'Queso suizo 0,350 kg');
eq('nombre sin peso igual', soldBy.weighedName('Café', undefined), 'Café');
eq('detalle del cobro', soldBy.weightDetail(0.35, 12000), DETAIL);

// ── Líneas de venta que manda la caja ───────────────────────────────
const parsed = saleItems.parseSaleItems([
  { productId: 'a', productName: 'Queso suizo', unitPrice: 12000, quantity: 1, weightKg: 0.35, lineTotal: 1 },
  { productId: 'b', productName: 'Café', unitPrice: 1500, quantity: 2 },
]);
eq('venta: total de la pieza lo calcula el servidor', parsed?.map((l) => l.lineTotal), [4200, 3000]);
eq('venta: la pieza guarda el peso', parsed?.[0].weightKg, 0.35);
eq('venta: la de precio fijo no lleva peso', 'weightKg' in (parsed?.[1] ?? {}), false);
eq('venta: peso inválido rechaza', saleItems.parseSaleItems([{ productName: 'Q', unitPrice: 12000, quantity: 1, weightKg: -2 }]), null);
eq('venta: peso en texto rechaza', saleItems.parseSaleItems([{ productName: 'Q', unitPrice: 12000, quantity: 1, weightKg: '1' }]), null);
eq('venta: cantidad sigue siendo entera', saleItems.parseSaleItems([{ productName: 'Q', unitPrice: 12000, quantity: 0.35 }]), null);
eq('venta vieja sin peso: misma clave que antes + peso vacío',
  saleItems.saleLineKey({ productId: 'b', unitPrice: 1500, extras: [] }), 'b|1500||');
eq('dos piezas de distinto peso no son la misma línea',
  saleItems.saleLineKey({ productId: 'a', unitPrice: 12000, extras: [], weightKg: 0.35 }) ===
  saleItems.saleLineKey({ productId: 'a', unitPrice: 12000, extras: [], weightKg: 0.4 }), false);

// Cobro de una comanda: el peso que quedó en la comanda tiene que coincidir con lo que manda la caja.
const comandaItem = { productId: 'a', productName: 'Queso suizo', unitPrice: 12000, quantity: 1, station: 'ninguna', note: '', paidQty: 0, extras: [], weightKg: 0.35 };
const fromComanda = saleItems.parseSaleItems([
  { productId: 'a', productName: 'Queso suizo', unitPrice: 12000, quantity: 1, weightKg: 0.35, comandaId: '64b7f0000000000000000001', comandaIndex: 0 },
])!;
const sel = [{ comandaId: '64b7f0000000000000000001', number: 7, items: [{ index: 0, qty: 1 }] }];
const map = new Map([['64b7f0000000000000000001', [comandaItem]]]);
eq('comanda: se cobra la pieza al peso comandado', saleItems.checkComandaLines(fromComanda, sel, map as never).map((l) => [l.weightKg, l.lineTotal]), [[0.35, 4200]]);
const tampered = saleItems.parseSaleItems([
  { productId: 'a', productName: 'Queso suizo', unitPrice: 12000, quantity: 1, weightKg: 0.1, comandaId: '64b7f0000000000000000001', comandaIndex: 0 },
])!;
throws('comanda: otro peso que el comandado se rechaza', () => saleItems.checkComandaLines(tampered, sel, map as never), 'COMANDA_ITEMS_MISMATCH');
const oldComanda = new Map([['64b7f0000000000000000001', [{ ...comandaItem, weightKg: undefined, unitPrice: 1500, productName: 'Café' }]]]);
const oldLine = saleItems.parseSaleItems([
  { productId: 'a', productName: 'Café', unitPrice: 1500, quantity: 1, comandaId: '64b7f0000000000000000001', comandaIndex: 0 },
])!;
eq('comanda vieja sin peso se cobra igual que antes', saleItems.checkComandaLines(oldLine, sel, oldComanda as never).map((l) => l.lineTotal), [1500]);

// ── Tiquete, comanda impresa y agente ───────────────────────────────
const rows = ticket.ticketItemRows([
  { productName: 'Queso suizo', quantity: 1, unitPrice: 12000, lineTotal: 4200, weightKg: 0.35 },
  { productName: 'Café', quantity: 2, unitPrice: 1500, lineTotal: 3000 },
]);
eq('tiquete: pieza con peso en el nombre y precio de la pieza', rows[0], {
  isExtra: false, name: 'Queso suizo 0,350 kg', quantity: 1, unitPrice: 4200, total: 4200, detail: DETAIL,
});
eq('tiquete: precio fijo igual que antes', rows[1], { isExtra: false, name: 'Café', quantity: 2, unitPrice: 1500, total: 3000 });
const saleData = {
  businessName: 'Canaán', saleNumber: 'A1', date: '2026-11-16T15:00:00.000Z', paymentMethod: 'efectivo',
  items: [{ productName: 'Queso suizo', quantity: 1, unitPrice: 12000, lineTotal: 4200, weightKg: 0.35 }],
  subtotal: 4200, total: 4200,
};
const text = ticket.buildSaleRows(saleData).map((r) => ('text' in r ? r.text : '')).join('\n');
eq('tiquete impreso trae el detalle del kilo', text.includes(DETAIL), true);
const payload = buildSalePayload(saleData, ticket.DEFAULT_TICKET_CONFIG, false);
eq('agente: Uds × P.U. = total (no sabe de kilos)', payload.items.map((i: { quantity: number; unitPrice: number; lineTotal: number; productName: string }) => [i.productName, i.quantity, i.unitPrice, i.lineTotal]),
  [['Queso suizo 0,350 kg', 1, 4200, 4200]]);
eq('cocina: el peso va primero en la nota', kitchenNote({ quantity: 1, weightKg: 0.35, note: 'en tajadas' }), '0,350 kg — en tajadas');
eq('cocina: sin peso igual que antes', kitchenNote({ quantity: 2, note: 'sin cebolla', extras: [{ name: 'Queso', price: 500 }] }), '+ Queso x2 — sin cebolla');

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log('\nTodo bien');
