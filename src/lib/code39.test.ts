// Prueba sin dependencias: `node --experimental-strip-types src/lib/code39.test.ts` (Node 22+).
// Code 39: patrones de la tabla estándar y barras que se pueden volver a leer.
import { canEncodeCode39, code39Bars, code39Pattern } from './code39.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

/** Patrón escrito como en la tabla estándar: b/w angostos, B/W anchos (barra/espacio). */
function written(ch: string): string {
  const p = code39Pattern(ch);
  return p ? p.map((wide, k) => (k % 2 === 0 ? (wide ? 'B' : 'b') : wide ? 'W' : 'w')).join('') : '';
}

eq('asterisco', written('*'), 'bWbwBwBwb');
eq('cero', written('0'), 'bwbWBwBwb');
eq('uno', written('1'), 'BwbWbwbwB');
eq('A', written('A'), 'BwbwbWbwB');
eq('K', written('K'), 'BwbwbwbWB');
eq('U', written('U'), 'BWbwbwbwB');
eq('signo $', written('$'), 'bWbWbWbwb');
eq('signo %', written('%'), 'bwbWbWbWb');

const ALL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';
eq('los 44 caracteres tienen 3 anchos', [...ALL].every((c) => code39Pattern(c)!.filter(Boolean).length === 3), true);
eq('ningún patrón se repite', new Set([...ALL].map(written)).size, 44);

eq('código interno se puede', canEncodeCode39('10001'), true);
eq('minúscula no (se pasa a mayúscula antes)', canEncodeCode39('qs'), false);
eq('asterisco adentro no', canEncodeCode39('10*01'), false);
eq('vacío no', canEncodeCode39(''), false);
eq('ñ no da barras', code39Bars('Ñ1'), null);

// 7 caracteres (*10001*) de 15 módulos más 6 espacios entre ellos.
eq('ancho de *10001*', code39Bars('10001')!.width, 111);
eq('se pasa a mayúsculas', code39Bars('qs-1')!.width, code39Bars('QS-1')!.width);

/** Lee las barras como lo haría un lector: anchos de barras y espacios, umbral a la mitad. */
function decode(text: string): string {
  const { bars, width } = code39Bars(text)!;
  const elems: number[] = [];
  bars.forEach((b, i) => {
    elems.push(b.w);
    const next = bars[i + 1];
    if (next) elems.push(next.x - b.x - b.w);
  });
  const byPattern = new Map([...ALL].map((c) => [written(c).replace(/[bw]/g, 'n').replace(/[BW]/g, 'W'), c]));
  let out = '';
  for (let i = 0; i < elems.length; i += 10) {
    const key = elems.slice(i, i + 9).map((w) => (w > 2 ? 'W' : 'n')).join('');
    out += byPattern.get(key) ?? '?';
  }
  return width > 0 ? out : '';
}
eq('se vuelve a leer', decode('10001'), '*10001*');
eq('se vuelve a leer con signos', decode('QS-01/A.$+%'), '*QS-01/A.$+%*');

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log('\nTodo bien');
