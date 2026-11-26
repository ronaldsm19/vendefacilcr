// Prueba sin dependencias: `node --experimental-strip-types src/lib/storagePaths.test.ts` (Node 22+).
// Rutas privadas: solo las del propio negocio y carpeta.
import { isOwnPrivatePath } from './storagePaths.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${expected}, obtuvo ${actual}`}`);
}

eq('propia', isOwnPrivatePath('cafe-el-roble/planilla/1732-abc.pdf', 'cafe-el-roble', 'planilla'), true);
eq('vacía (opcional)', isOwnPrivatePath('', 'cafe-el-roble', 'planilla'), true);
eq('sin valor', isOwnPrivatePath(undefined, 'cafe-el-roble', 'planilla'), true);
eq('de otro negocio', isOwnPrivatePath('soda-la-esquina/planilla/1.pdf', 'cafe-el-roble', 'planilla'), false);
eq('otra carpeta', isOwnPrivatePath('cafe-el-roble/mensualidad/1.png', 'cafe-el-roble', 'planilla'), false);
eq('subiendo carpetas', isOwnPrivatePath('cafe-el-roble/planilla/../../soda/planilla/1.pdf', 'cafe-el-roble', 'planilla'), false);
eq('punto punto', isOwnPrivatePath('cafe-el-roble/planilla/..', 'cafe-el-roble', 'planilla'), false);
eq('prefijo parecido', isOwnPrivatePath('cafe-el-roble-2/planilla/1.pdf', 'cafe-el-roble', 'planilla'), false);
eq('no es texto', isOwnPrivatePath({ $ne: '' }, 'cafe-el-roble', 'planilla'), false);
eq('barra invertida', isOwnPrivatePath('cafe-el-roble/planilla/a\\b.pdf', 'cafe-el-roble', 'planilla'), false);

if (failed) {
  console.log(`\n${failed} fallo(s)`);
  process.exit(1);
}
