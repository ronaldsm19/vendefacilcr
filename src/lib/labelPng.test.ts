// Prueba: `node --experimental-transform-types src/lib/labelPng.test.ts` (Node 22.7+).
// Lo que se puede probar sin navegador de la etiqueta para el agente (renglones, achicado y barras
// en puntos enteros) y la lectura de la báscula con las respuestas reales del agente 1.4.0.
import { register } from 'node:module';

const hook = `
const SRC = ${JSON.stringify(new URL('../', import.meta.url).href)};
export async function resolve(specifier, context, next) {
  let s = specifier;
  if (s.startsWith('@/')) s = SRC + s.slice(2);
  const local = s.startsWith(SRC) || ((s.startsWith('./') || s.startsWith('../')) && context.parentURL && context.parentURL.startsWith(SRC));
  if (local && !/\\.[a-z]+$/i.test(s)) {
    try { return await next(s + '.ts', context); } catch { return next(s + '/index.ts', context); }
  }
  return next(s, context);
}`;
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);

const png = await import('./labelPng.ts');
const { readScaleKg } = await import('./scale.ts');

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

// ── Tamaño ──────────────────────────────────────────────────────────
eq('480 × 320 px = 60 × 40 mm a 203 dpi', [png.LABEL_PNG_WIDTH, png.LABEL_PNG_HEIGHT], [480, 320]);

// ── Renglones (medida falsa: 10 px por letra) ───────────────────────
const fits = (max: number) => (s: string) => s.length * 10 <= max;
eq('cabe en un renglón', png.wrapText('Queso suizo', 200, fits(200)), ['Queso suizo']);
eq('parte por palabras', png.wrapText('Queso madurado dos años', 150, fits(150)), ['Queso madurado', 'dos años']);
eq('palabra larguísima se corta por letras', png.wrapText('ABCDEFGHIJKL', 50, fits(50)), ['ABCDE', 'FGHIJ', 'KL']);
eq('espacios de más no cuentan', png.wrapText('  a   b ', 100, fits(100)), ['a b']);

const measure = (text: string, px: number) => text.length * px * 0.5;
const roomy = png.layoutLines([{ text: 'Quesos Canaán', size: 'lg', bold: true }, { text: '', size: 'sm', bold: false }], 448, 200, measure);
eq('cabe sin achicar y la línea vacía no cuenta', [roomy.scale, roomy.rows.length, roomy.overflow], [1, 1, false]);
const many = Array.from({ length: 8 }, (_, i) => ({ text: `Línea número ${i + 1} con bastante texto para llenar`, size: 'lg' as const, bold: false }));
const tight = png.layoutLines(many, 448, 150, measure);
eq('mucho texto se achica', tight.scale < 1, true);
eq('ni a la mitad cabe: avisa que se corta', [tight.scale, tight.overflow], [0.5, true]);
const fitted = png.layoutLines(many.slice(0, 3), 448, 150, measure);
eq('achicado lo justo cabe', fitted.overflow === false && fitted.height <= 150, true);

// ── Código de barras en puntos enteros ──────────────────────────────
const short = png.placeBarcode('10001', 448)!;
eq('código corto: barra angosta de 2 puntos y ancha de 6', [short.modulePx, short.ratio], [2, 3]);
eq('todas las barras caen en píxeles enteros', short.bars.bars.every((b) => Number.isInteger(b.x * short.modulePx) && Number.isInteger(b.w * short.modulePx)), true);
eq('cabe con margen blanco', short.widthPx + 2 * 10 * short.modulePx <= 448, true);
const longer = png.placeBarcode('ABC123456789', 448)!;
eq('código de 12: anchas más delgadas antes que barras de 1 punto', [longer.modulePx, longer.ratio <= 2.5], [2, true]);
eq('anchas de 2,5× también caen en píxeles enteros', longer.bars.bars.every((b) => Number.isInteger(b.x * longer.modulePx) && Number.isInteger(b.w * longer.modulePx)), true);
eq('carácter que Code 39 no tiene', png.placeBarcode('Ñ1', 448), null);

// ── Báscula: respuestas reales del agente 1.4.0 ─────────────────────
const reply = (body: unknown) => { globalThis.fetch = (async () => ({ json: async () => body })) as never; };
reply({ ok: true, disponible: true, peso: 0.29, unidad: 'kg', pesoKg: 0.29, estable: null, edadMs: 151, crudo: '0.290 kg' });
eq('báscula sin estabilidad (null): peso bueno, sin aviso', await readScaleKg(), { kg: 0.29, tone: 'ok', text: 'Peso leído de la báscula' });
reply({ ok: true, disponible: true, pesoKg: 0.2904, estable: true });
eq('estable: true, redondeado a gramos', (await readScaleKg()).kg, 0.29);
reply({ ok: true, disponible: true, pesoKg: 0.3, estable: false });
eq('solo estable: false avisa que se mueve', (await readScaleKg()).tone, 'warn');
reply({ ok: true, disponible: false, motivo: 'lectura_vieja' });
eq('motivo en palabras', await readScaleKg(), { tone: 'error', text: 'La báscula dejó de mandar el peso: revisá que esté encendida' });
reply({ ok: true, disponible: false, motivo: 'algo_nuevo' });
eq('motivo desconocido', (await readScaleKg()).text, 'La báscula no está conectada al agente');
reply({ ok: true, disponible: true, pesoKg: 0, estable: null });
eq('marca 0', (await readScaleKg()).tone, 'warn');
globalThis.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as never;
eq('sin agente', (await readScaleKg()).tone, 'error');

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log('\nTodo bien');
