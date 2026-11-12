// Prueba sin dependencias: `node --experimental-strip-types src/lib/shiftQrCode.test.ts` (Node 22+).
import {
  SHIFT_QR_ALPHABET,
  SHIFT_QR_STEP_MS,
  matchesShiftQr,
  normalizeShiftQrCode,
  shiftQrCode,
  shiftQrStep,
} from './shiftQrCode.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (esperado ${JSON.stringify(expected)})`}`);
}

const secret = 'secreto-de-prueba';
const tenant = '665f1c2e9a1b2c3d4e5f6a7b';
const otherTenant = '665f1c2e9a1b2c3d4e5f6a7c';
// Un instante a mitad de un tramo, para que sumar segundos no lo cruce por accidente.
const t0 = 1_800_000_000_000 - (1_800_000_000_000 % SHIFT_QR_STEP_MS) + 10_000;
const step = shiftQrStep(t0);
const code = shiftQrCode(secret, tenant, step);

// ── Forma del código ──
eq('tiene ocho caracteres', code.length, 8);
eq('solo usa letras y números que no se confunden', [...code].every((c) => SHIFT_QR_ALPHABET.includes(c)), true);
eq('el mismo negocio y tramo dan siempre el mismo código', shiftQrCode(secret, tenant, step), code);

// ── Qué lo hace cambiar ──
eq('cambia en el tramo siguiente', shiftQrCode(secret, tenant, step + 1) === code, false);
eq('otro negocio tiene otro código', shiftQrCode(secret, otherTenant, step) === code, false);
eq('otro secreto da otro código', shiftQrCode('otro-secreto', tenant, step) === code, false);

// ── Cuánto vive ──
eq('vale en el momento en que se muestra', matchesShiftQr(secret, tenant, code, t0), true);
eq('vale hasta el final de su tramo', matchesShiftQr(secret, tenant, code, t0 + 19_999), true);
eq('vale durante el tramo siguiente', matchesShiftQr(secret, tenant, code, t0 + 20_000 + 29_999), true);
eq('ya no vale dos tramos después', matchesShiftQr(secret, tenant, code, t0 + 20_000 + 30_000), false);
eq('el del tramo que viene todavía no vale', matchesShiftQr(secret, tenant, shiftQrCode(secret, tenant, step + 1), t0), false);

// ── A quién le sirve ──
eq('no vale en otro negocio', matchesShiftQr(secret, otherTenant, code, t0), false);
eq('no vale con otro secreto', matchesShiftQr('otro-secreto', tenant, code, t0), false);

// ── Cómo llega del teléfono ──
const pretty = `${code.slice(0, 4)}-${code.slice(4)}`;
eq('vale escrito con guion y en minúsculas', matchesShiftQr(secret, tenant, pretty.toLowerCase(), t0), true);
eq('vale como viene dentro del QR', matchesShiftQr(secret, tenant, `VFJ:${code}`, t0), true);
eq('normaliza espacios, guiones y el prefijo', normalizeShiftQrCode(` vfj:${pretty.toLowerCase()} `), code);
eq('un código de otro largo no vale', matchesShiftQr(secret, tenant, code.slice(0, 7), t0), false);
eq('vacío no vale', matchesShiftQr(secret, tenant, '', t0), false);
eq('con caracteres raros no vale ni rompe', matchesShiftQr(secret, tenant, 'ñññññññññ', t0), false);

// Con un carácter cambiado, no vale. Se prueba en las ocho posiciones.
const tampered = [...code].map((c, i) => {
  const other = SHIFT_QR_ALPHABET[(SHIFT_QR_ALPHABET.indexOf(c) + 1) % SHIFT_QR_ALPHABET.length];
  return code.slice(0, i) + other + code.slice(i + 1);
});
eq('cambiar un solo carácter lo invalida', tampered.some((x) => matchesShiftQr(secret, tenant, x, t0)), false);

// ── Reparto ──
// Que el código no tenga letras favoritas: en muchos códigos, todas aparecen parecido.
const counts = new Map<string, number>();
for (let s = 0; s < 4000; s++) for (const c of shiftQrCode(secret, tenant, s)) counts.set(c, (counts.get(c) ?? 0) + 1);
const expected = (4000 * 8) / SHIFT_QR_ALPHABET.length;
const worst = Math.max(...[...SHIFT_QR_ALPHABET].map((c) => Math.abs((counts.get(c) ?? 0) - expected) / expected));
eq('usa todo el alfabeto de forma pareja (desvío menor al 15 %)', worst < 0.15, true);

console.log(failed === 0 ? 'todo bien' : `${failed} fallas`);
if (failed > 0) process.exit(1);
