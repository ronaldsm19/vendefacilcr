// Prueba sin dependencias: `node --experimental-strip-types src/lib/mensualidad.test.ts` (Node 22+).
// Comprobantes de la mensualidad: estados que ve el dueño, revisión y qué se puede hacer en cada caso.
import {
  MENSUALIDAD_DESDE,
  PROOF_LIMITS,
  canDeleteProof,
  canReview,
  ownerStatusOf,
  proofPath,
  reviewStatusOf,
  shownToOwner,
  sniffProofType,
  uploadBlockedReason,
} from './mensualidad.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (esperado ${JSON.stringify(expected)})`}`);
}

// ── Desde qué mes ve el dueño ──
eq('arranca en noviembre 2026', MENSUALIDAD_DESDE, 202611);
eq('octubre 2026 no se muestra', shownToOwner(2026, 10), false);
eq('noviembre 2026 sí', shownToOwner(2026, 11), true);
eq('enero 2027 sí', shownToOwner(2027, 1), true);

// ── Revisión según los comprobantes ──
const p = (status: 'submitted' | 'approved' | 'rejected', day: number) => ({ status, uploadedAt: new Date(Date.UTC(2026, 10, day)) });
eq('sin comprobantes', reviewStatusOf([]), 'none');
eq('uno esperando', reviewStatusOf([p('submitted', 2)]), 'submitted');
eq('rechazado y después otro esperando', reviewStatusOf([p('rejected', 2), p('submitted', 3)]), 'submitted');
eq('rechazado y después aprobado', reviewStatusOf([p('rejected', 2), p('approved', 3)]), 'approved');
eq('solo rechazado', reviewStatusOf([p('rejected', 2)]), 'rejected');
eq('aprobado más viejo que un rechazado', reviewStatusOf([p('approved', 5), p('rejected', 2)]), 'approved');

// ── Lo que ve el dueño ──
eq('pagada', ownerStatusOf({ status: 'paid', review: { status: 'approved' } }), 'verificado');
eq('pagada a mano sin comprobante', ownerStatusOf({ status: 'paid' }), 'verificado');
eq('cortesía', ownerStatusOf({ status: 'cortesia' }), 'sin_costo');
eq('anulada', ownerStatusOf({ status: 'cancelled', review: { status: 'submitted' } }), 'anulada');
eq('pendiente sin comprobante', ownerStatusOf({ status: 'pending' }), 'pendiente');
eq('factura vieja sin review', ownerStatusOf({ status: 'pending', review: null }), 'pendiente');
eq('atrasada sin comprobante', ownerStatusOf({ status: 'late', review: { status: 'none' } }), 'atrasada');
eq('atrasada con comprobante esperando', ownerStatusOf({ status: 'late', review: { status: 'submitted' } }), 'revision');
eq('pendiente con comprobante rechazado', ownerStatusOf({ status: 'pending', review: { status: 'rejected' } }), 'rechazado');

// ── Subir, quitar y revisar ──
eq('se puede subir a una pendiente', uploadBlockedReason({ status: 'pending', proofs: [] }), null);
eq('se puede subir a una atrasada', uploadBlockedReason({ status: 'late' }), null);
eq('no a una pagada', uploadBlockedReason({ status: 'paid' }), 'Este mes ya está pagado.');
eq('no a una cortesía', uploadBlockedReason({ status: 'cortesia' }), 'Este mes no se cobra.');
eq('no a una anulada', uploadBlockedReason({ status: 'cancelled' }), 'Este mes no se cobra.');
eq('tope de comprobantes', uploadBlockedReason({ status: 'pending', proofs: new Array(PROOF_LIMITS.perInvoice).fill(0) }) !== null, true);
eq('uno menos del tope', uploadBlockedReason({ status: 'pending', proofs: new Array(PROOF_LIMITS.perInvoice - 1).fill(0) }), null);

eq('quitar uno sin revisar', canDeleteProof({ status: 'pending' }, { status: 'submitted' }), true);
eq('no quitar uno rechazado', canDeleteProof({ status: 'pending' }, { status: 'rejected' }), false);
eq('no quitar de un mes pagado', canDeleteProof({ status: 'paid' }, { status: 'submitted' }), false);

eq('revisar uno esperando', canReview({ status: 'late', review: { status: 'submitted' } }), true);
eq('no revisar sin comprobante', canReview({ status: 'pending' }), false);
eq('no revisar uno ya pagado', canReview({ status: 'paid', review: { status: 'submitted' } }), false);

// ── Archivo ──
eq('ruta debajo del negocio', proofPath('kahve-tanna', 2026, 11, 'abc', 'jpg'), 'kahve-tanna/mensualidad/202611-abc.jpg');
eq('ruta con mes de un dígito', proofPath('x', 2027, 3, 'r', 'pdf'), 'x/mensualidad/202703-r.pdf');
eq('jpeg', sniffProofType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
eq('png', sniffProofType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
eq('webp', sniffProofType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
eq('pdf', sniffProofType(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
eq('html disfrazado', sniffProofType(new TextEncoder().encode('<html><script>')), null);
eq('vacío', sniffProofType(new Uint8Array([])), null);

if (failed) {
  console.log(`\n${failed} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\nTodo bien');
