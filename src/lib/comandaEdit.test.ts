// Prueba sin dependencias: `node --experimental-strip-types src/lib/comandaEdit.test.ts` (Node 22+).
// Editar una comanda con algo ya cobrado: lo cobrado queda fijo, lo pendiente se reemplaza.
import { hasPaidItems, paidUnits, paidView, pendingView, planComandaEdit, remapClaims } from './comandaEdit.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

const line = (name: string, quantity: number, paidQty = 0) => ({ name, quantity, paidQty });

// La comanda de la foto: se pagaron varios platos y quedaron dos "Comida" pendientes.
const foto = [line('Pizza', 1, 1), line('Bowl', 1, 1), line('Comida 1300', 1, 0), line('Batido', 1, 1), line('Comida 500', 1, 0), line('Tamal', 1, 1)];

eq('unidades cobradas', paidUnits(foto), 4);
eq('tiene algo cobrado', hasPaidItems(foto), true);
eq('nada cobrado', hasPaidItems([line('A', 2)]), false);
eq('lo pendiente', pendingView(foto).map((i) => i.name), ['Comida 1300', 'Comida 500']);
eq('lo cobrado', paidView(foto).map((i) => i.name), ['Pizza', 'Bowl', 'Batido', 'Tamal']);

// Línea a medio cobrar: 3 pedidas, 1 pagada → 1 fija y 2 pendientes.
const medio = [line('Café', 3, 1)];
eq('medio cobrada: pendiente', pendingView(medio), [{ name: 'Café', quantity: 2, paidQty: 0 }]);
eq('medio cobrada: cobrado', paidView(medio), [{ name: 'Café', quantity: 1, paidQty: 1 }]);

// Quitar lo pendiente de la foto: quedan solo las 4 cobradas y se mueven de posición.
const quitar = planComandaEdit(foto, []);
eq('quitar pendiente: ítems', quitar.items.map((i) => `${i.name}:${i.quantity}/${i.paidQty}`), ['Pizza:1/1', 'Bowl:1/1', 'Batido:1/1', 'Tamal:1/1']);
eq('quitar pendiente: cierra', quitar.nothingPending, true);
eq('quitar pendiente: posiciones', [...quitar.indexMap], [[0, 0], [1, 1], [3, 2], [5, 3]]);
eq('quitar pendiente: hubo movimiento', quitar.moved, true);

// Cambiar lo pendiente: lo cobrado primero, lo nuevo después.
const cambiar = planComandaEdit(foto, [line('Refresco', 2), line('Postre', 1)]);
eq('cambiar pendiente: ítems', cambiar.items.map((i) => i.name), ['Pizza', 'Bowl', 'Batido', 'Tamal', 'Refresco', 'Postre']);
eq('cambiar pendiente: no cierra', cambiar.nothingPending, false);

// Sin nada cobrado es un reemplazo normal y no hay nada que mover.
const normal = planComandaEdit([line('A', 1), line('B', 2)], [line('C', 1)]);
eq('sin cobros: ítems', normal.items.map((i) => i.name), ['C']);
eq('sin cobros: sin movimiento', normal.moved, false);
eq('sin cobros: mapa vacío', normal.indexMap.size, 0);

// Lo cobrado al inicio no se mueve aunque se quite lo de después.
const alInicio = planComandaEdit([line('A', 1, 1), line('B', 1, 1), line('C', 1)], []);
eq('cobrado al inicio: sin movimiento', alInicio.moved, false);

// Línea a medio cobrar: al editar, la parte cobrada queda con cantidad = lo pagado.
const partida = planComandaEdit(medio, [line('Café', 1)]);
eq('medio cobrada: resultado', partida.items, [{ name: 'Café', quantity: 1, paidQty: 1 }, { name: 'Café', quantity: 1, paidQty: 0 }]);

// Las ventas apuntan a la posición nueva; las de otras comandas no se tocan.
const claims = [
  { comandaId: 'c1', items: [{ index: 3, qty: 1 }, { index: 5, qty: 1 }] },
  { comandaId: 'c2', items: [{ index: 3, qty: 2 }] },
];
eq('ventas: posiciones nuevas', remapClaims(claims, 'c1', quitar.indexMap), [
  { comandaId: 'c1', items: [{ index: 2, qty: 1 }, { index: 3, qty: 1 }] },
  { comandaId: 'c2', items: [{ index: 3, qty: 2 }] },
]);

console.log(failed ? `\n${failed} fallaron` : '\ntodas bien');
if (failed) process.exit(1);
