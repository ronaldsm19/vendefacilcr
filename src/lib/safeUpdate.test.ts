// Prueba sin dependencias: `node --experimental-strip-types src/lib/safeUpdate.test.ts` (Node 22+).
// Cuerpo de las actualizaciones: sin operadores ni campos protegidos.
import { safeUpdate } from './safeUpdate.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

eq('campos normales pasan', safeUpdate({ name: 'Café', price: 1500 }), { name: 'Café', price: 1500 });
eq('tenantId directo se quita', safeUpdate({ name: 'x', tenantId: 'otro' }), { name: 'x' });
eq('$set se quita', safeUpdate({ $set: { tenantId: 'otro' }, name: 'x' }), { name: 'x' });
eq('cualquier operador se quita', safeUpdate({ $push: { items: 1 }, $unset: { name: 1 }, $rename: { a: 'b' } }), {});
eq('subcampo con punto se quita', safeUpdate({ 'items.0.price': 1, paid: true }), { paid: true });
eq('_id y fechas internas se quitan', safeUpdate({ _id: '1', __v: 3, createdAt: 'x', updatedAt: 'y', notes: 'n' }), { notes: 'n' });
eq('protegidos extra', safeUpdate({ toppings: [], name: 'x' }, ['toppings']), { name: 'x' });
eq('cuerpo que no es objeto', safeUpdate('hola'), {});
eq('cuerpo arreglo', safeUpdate([{ $set: {} }]), {});
eq('cuerpo nulo', safeUpdate(null), {});

if (failed) {
  console.log(`\n${failed} fallo(s)`);
  process.exit(1);
}
