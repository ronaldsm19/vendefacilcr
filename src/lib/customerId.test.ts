// Prueba sin dependencias: `node --experimental-strip-types src/lib/customerId.test.ts` (Node 22+).
// Validación y formato de las cédulas de los clientes que piden factura.
import { formatIdNumber, guessIdType, idNumberError, normalizeIdNumber, searchKey } from './customerId.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

eq('quita guiones y espacios', normalizeIdNumber(' 3-101 123456 '), '3101123456');

eq('física válida', idNumberError('01', '112345678'), null);
eq('física corta', typeof idNumberError('01', '11234567'), 'string');
eq('jurídica válida', idNumberError('02', '3101123456'), null);
eq('jurídica que no empieza con 3', typeof idNumberError('02', '2101123456'), 'string');
eq('DIMEX de 11', idNumberError('03', '17240012345'), null);
eq('DIMEX de 12', idNumberError('03', '172400123456'), null);
eq('DIMEX de 10', typeof idNumberError('03', '1724001234'), 'string');
eq('NITE de 10', idNumberError('04', '1234567890'), null);
eq('vacío', typeof idNumberError('01', ''), 'string');

eq('adivina física', guessIdType('112345678'), '01');
eq('adivina jurídica', guessIdType('3101123456'), '02');
eq('adivina DIMEX', guessIdType('172400123456'), '03');
eq('10 dígitos sin 3 no adivina', guessIdType('1234567890'), null);

eq('formato física', formatIdNumber('01', '112345678'), '1-1234-5678');
eq('formato jurídica', formatIdNumber('02', '3101123456'), '3-101-123456');
eq('DIMEX corrido', formatIdNumber('03', '172400123456'), '172400123456');

eq('búsqueda sin tildes', searchKey('  José   Peña  '), 'jose pena');

if (failed) {
  console.log(`\n${failed} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\nTodo bien');
