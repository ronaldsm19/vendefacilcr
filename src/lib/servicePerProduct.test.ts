// Prueba sin dependencias: `node --experimental-strip-types src/lib/servicePerProduct.test.ts` (Node 22+).
// El servicio (10 %) se cobra solo sobre los productos que lo llevan.
import { computeSaleTotals, serviceBaseOf, subtotalOf, DEFAULT_POS_CHARGES } from './pricing.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

const charges = { ...DEFAULT_POS_CHARGES, serviceEnabled: true, serviceRate: 10 };
// Un casado (lleva servicio) y un queso de la tienda (no lleva).
const lines = [
  { productId: 'casado', unitPrice: 4500, quantity: 2 },
  { productId: 'queso', unitPrice: 6500, quantity: 1 },
];
const exempt = new Set(['queso']);

eq('subtotal', subtotalOf(lines), 15500);
eq('base del servicio: solo el casado', serviceBaseOf(lines, exempt), 9000);
eq('sin productos exentos: todo', serviceBaseOf(lines, new Set()), 15500);
eq('todo exento: cero', serviceBaseOf([lines[1]], exempt), 0);
eq('línea sin producto conocido paga', serviceBaseOf([{ unitPrice: 1000, quantity: 1 }], exempt), 1000);

const mixta = computeSaleTotals({ subtotal: 15500, serviceBase: 9000, charges, orderType: 'LOCAL' });
eq('venta mixta: servicio solo sobre el casado', mixta.serviceAmount, 900);
eq('venta mixta: total', mixta.total, 16400);

const sinBase = computeSaleTotals({ subtotal: 15500, charges, orderType: 'LOCAL' });
eq('sin base (como antes): sobre todo', sinBase.serviceAmount, 1550);

const tienda = computeSaleTotals({ subtotal: 6500, serviceBase: 0, charges, orderType: 'LOCAL' });
eq('solo tienda: sin servicio', tienda.serviceAmount, 0);
eq('solo tienda: total = subtotal', tienda.total, 6500);

const pickup = computeSaleTotals({ subtotal: 15500, serviceBase: 9000, charges, orderType: 'PICKUP' });
eq('para llevar: nunca cobra servicio', pickup.serviceAmount, 0);

const apagado = computeSaleTotals({ subtotal: 15500, serviceBase: 9000, charges, orderType: 'LOCAL', applied: { service: false } });
eq('el cajero lo apagó en esta venta', apagado.serviceAmount, 0);

const negocioSin = computeSaleTotals({ subtotal: 15500, serviceBase: 9000, charges: DEFAULT_POS_CHARGES, orderType: 'LOCAL' });
eq('negocio sin servicio activo', negocioSin.serviceAmount, 0);

eq('base mayor que el subtotal se recorta', computeSaleTotals({ subtotal: 1000, serviceBase: 5000, charges, orderType: 'LOCAL' }).serviceAmount, 100);

// Extras y peso entran en la base igual que en el subtotal.
const conExtra = [{ productId: 'casado', unitPrice: 4500, quantity: 1, extras: [{ name: 'Aguacate', price: 500 }] }];
eq('extras entran en la base', serviceBaseOf(conExtra, exempt), 5000);

console.log(failed ? `\n${failed} fallaron` : '\ntodas bien');
if (failed) process.exit(1);
