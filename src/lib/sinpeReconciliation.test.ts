// Prueba sin dependencias: `node --experimental-strip-types src/lib/sinpeReconciliation.test.ts` (Node 22+).
// Cuadre de SINPE al cerrar el día: opcional, pero si se llena y no cuadra hay que decir por qué.
import { checkSinpeReconciliation, sinpeDifferenceLabel, SINPE_NOTE_REQUIRED, SINPE_REPORTED_INVALID } from './cardReconciliation.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}
const pick = (r: ReturnType<typeof checkSinpeReconciliation>) =>
  r.ok ? (r.value ? { expected: r.value.expected, reported: r.value.reported, difference: r.value.difference, note: r.value.note, by: r.value.checkedBy } : null) : { code: r.code };

eq('sin revisar: se cierra igual', pick(checkSinpeReconciliation(102252, undefined, 'Ana')), null);
eq('campo vacío: se cierra igual', pick(checkSinpeReconciliation(102252, { reported: '' }, 'Ana')), null);
eq('cuadra', pick(checkSinpeReconciliation(102252, { reported: 102252 }, 'Ana')), { expected: 102252, reported: 102252, difference: 0, note: '', by: 'Ana' });
eq('cuadra escrito como texto', pick(checkSinpeReconciliation(102252, { reported: '102252' }, 'Ana')), { expected: 102252, reported: 102252, difference: 0, note: '', by: 'Ana' });
eq('entró más y sin motivo: no deja', pick(checkSinpeReconciliation(102252, { reported: 107252 }, 'Ana')), { code: SINPE_NOTE_REQUIRED });
eq('entró más con motivo', pick(checkSinpeReconciliation(102252, { reported: 107252, note: ' No se anotó un SINPE de 5000 ' }, 'Ana')),
  { expected: 102252, reported: 107252, difference: 5000, note: 'No se anotó un SINPE de 5000', by: 'Ana' });
eq('entró menos con motivo', pick(checkSinpeReconciliation(102252, { reported: 100000, note: 'x' }, 'Ana'))?.difference, -2252);
eq('monto negativo', pick(checkSinpeReconciliation(102252, { reported: -1 }, 'Ana')), { code: SINPE_REPORTED_INVALID });
eq('texto que no es número', pick(checkSinpeReconciliation(102252, { reported: 'abc' }, 'Ana')), { code: SINPE_REPORTED_INVALID });
eq('día sin SINPE y banco en cero', pick(checkSinpeReconciliation(0, { reported: 0 }, 'Ana'))?.difference, 0);
eq('etiqueta: cuadra', sinpeDifferenceLabel(0), 'Cuadra con el banco');
eq('etiqueta: sobra', sinpeDifferenceLabel(5000), 'Entró más SINPE del anotado');
eq('etiqueta: falta', sinpeDifferenceLabel(-1), 'Entró menos SINPE del anotado');

console.log(failed ? `\n${failed} fallaron` : '\ntodas bien');
if (failed) process.exit(1);
