// Prueba sin dependencias: `node --experimental-strip-types src/lib/saleReceipt.test.ts` (Node 22+).
// Qué dice el comprobante de venta que se le manda por correo al cliente.
import {
  crDateTimeLabel, isSimplifiedRegime, pdfAmount, receiptFooterLines, receiptLabel, receiptTotalRows, summarizeInvoice,
} from './saleReceipt.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

eq('sin IVA ni servicio: solo subtotal y total',
  receiptTotalRows({ subtotal: 5000, total: 5000 }).map((r) => r.label),
  ['Subtotal', 'Total']);

eq('mesa con servicio e IVA',
  receiptTotalRows({ subtotal: 10000, serviceAmount: 1000, serviceRate: 10, ivaAmount: 1300, ivaRate: 13, total: 12300 }),
  [
    { label: 'Subtotal', amount: 10000 },
    { label: 'Servicio (10 %)', amount: 1000 },
    { label: 'IVA (13 %)', amount: 1300 },
    { label: 'Total', amount: 12300, strong: true },
  ]);

eq('express con envío y propina, IVA en cero no sale',
  receiptTotalRows({ subtotal: 8000, ivaAmount: 0, deliveryFee: 1500, tipAmount: 500, total: 10000 }).map((r) => r.label),
  ['Subtotal', 'Envío', 'Propina', 'Total']);

eq('simplificado con mayúscula y tilde', isSimplifiedRegime('Régimen Simplificado'), true);
eq('simplificado en minúscula', isSimplifiedRegime('regimen simplificado'), true);
eq('tradicional no', isSimplifiedRegime('Régimen General'), false);
eq('vacío no', isSimplifiedRegime(''), false);

eq('pie del simplificado', receiptFooterLines('Régimen Simplificado').length, 2);
eq('pie del general solo dice que no es electrónico', receiptFooterLines('Régimen general'), ['Este documento no es un comprobante electrónico de Hacienda.']);

eq('número con prefijo', receiptLabel('A-', 1234), 'A-1234');
eq('número sin prefijo', receiptLabel('', 7), '7');

eq('monto con decimales y millares normales', pdfAmount(12345.5), '12 345,50');
eq('monto negativo', pdfAmount(-200), '-200,00');

// 14 nov 2026 18:30 UTC = 12:30 p. m. en Costa Rica (UTC-6).
const label = crDateTimeLabel('2026-11-14T18:30:00Z');
eq('fecha en hora de Costa Rica', label.startsWith('14 de noviembre de 2026, 12:30'), true);

eq('venta sin factura', summarizeInvoice(undefined), null);
eq('factura sin tipo cuenta como sin factura', summarizeInvoice({ kind: '' }), null);
eq('factura enviada', summarizeInvoice({
  kind: 'comprobante', customer: { name: 'Purdy', email: 'a@b.cr' }, emailStatus: 'enviado',
  emailSentAt: '2026-11-14T06:18:24.160Z', outdated: false, emailError: '',
}), { customerName: 'Purdy', email: 'a@b.cr', status: 'enviado', sentAt: '2026-11-14T06:18:24.160Z', outdated: false, error: '' });
eq('estado desconocido queda vacío', summarizeInvoice({ kind: 'comprobante', emailStatus: 'raro' })?.status, '');

if (failed) {
  console.log(`\n${failed} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\nTodo bien');
