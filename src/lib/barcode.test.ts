// Prueba sin dependencias: `node --experimental-strip-types src/lib/barcode.test.ts` (Node 22+).
// Códigos de barras de productos: limpieza, comparación y siguiente código interno.
import { MAX_BARCODE, nextInternalCode, normalizeBarcode, sameBarcode } from './barcode.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

eq('código interno corto', normalizeBarcode(' 1105 '), '1105');
eq('número desde Excel', normalizeBarcode(10001), '10001');
eq('EAN-13 de fábrica', normalizeBarcode('7441001234567'), '7441001234567');
eq('Code 39 con signos', normalizeBarcode('QS-01/A'), 'QS-01/A');
eq('se guarda en mayúsculas', normalizeBarcode('qs-01'), 'QS-01');
eq('vacío = sin código', normalizeBarcode('   '), '');
eq('undefined = sin código', normalizeBarcode(undefined), '');
eq('espacio adentro no vale', normalizeBarcode('11 05'), null);
eq('tilde no vale', normalizeBarcode('Queso-ñ'), null);
eq('demasiado largo', normalizeBarcode('1'.repeat(MAX_BARCODE + 1)), null);
eq('objeto no vale', normalizeBarcode({}), null);

eq('compara sin mayúsculas', sameBarcode('qs-01', 'QS-01'), true);
eq('vacío nunca coincide', sameBarcode('', ''), false);

eq('primer código', nextInternalCode([]), '1001');
eq('sigue la numeración', nextInternalCode(['1105', '10001', '1200']), '10002');
eq('EAN-13 no cuenta', nextInternalCode(['1105', '7441001234567']), '1106');
eq('ignora letras', nextInternalCode(['QS-01', undefined, '']), '1001');

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log('\ntodo bien');
