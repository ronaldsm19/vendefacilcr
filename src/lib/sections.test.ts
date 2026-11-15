// Prueba sin dependencias: `node --experimental-strip-types src/lib/sections.test.ts` (Node 22+).
// Secciones del negocio: lectura, asignación por categoría y totales por sección.
import {
  OTHER_SECTION_ID, categorySectionMap, readSections, sectionOfCategory, totalsBySection, visibleSections,
} from './sections.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

const CAF = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const QUE = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const GONE = 'cccccccccccccccccccccccc';
const sections = [{ id: CAF, name: 'Cafetería' }, { id: QUE, name: 'Tienda de quesos' }];

eq('lee _id de Mongo y descarta inválidas', readSections([
  { _id: CAF, name: ' Cafetería ' }, { _id: 'x', name: 'Mala' }, { id: QUE, name: '' }, null,
]), [{ id: CAF, name: 'Cafetería' }]);
eq('no arreglo → vacío', readSections(undefined), []);

const map = categorySectionMap(sections, [
  { label: 'Bebidas', sectionId: CAF },
  { label: 'Quesos', sectionId: QUE },
  { label: 'Vieja', sectionId: GONE },
  { label: 'Suelta', sectionId: '' },
]);
eq('categoría asignada', sectionOfCategory(map, 'Quesos'), QUE);
eq('sección borrada cae en otros', sectionOfCategory(map, 'Vieja'), OTHER_SECTION_ID);
eq('sin sección cae en otros', sectionOfCategory(map, 'Suelta'), OTHER_SECTION_ID);
eq('categoría desconocida cae en otros', sectionOfCategory(map, 'Escrita a mano'), OTHER_SECTION_ID);

eq('solo secciones con productos, Otros al final',
  visibleSections(sections, [QUE, OTHER_SECTION_ID]).map((s) => s.name), ['Tienda de quesos', 'Otros']);
eq('sin Otros si todo tiene sección',
  visibleSections(sections, [CAF, QUE]).map((s) => s.name), ['Cafetería', 'Tienda de quesos']);

eq('totales: todas las configuradas aunque estén en 0', totalsBySection(sections, [
  { sectionId: CAF, revenue: 5000, units: 2 },
  { sectionId: CAF, revenue: 300, units: 1 },
]), [
  { sectionId: CAF, name: 'Cafetería', revenue: 5300, units: 3 },
  { sectionId: QUE, name: 'Tienda de quesos', revenue: 0, units: 0 },
]);
eq('totales: id desconocido suma en Otros', totalsBySection(sections, [
  { sectionId: GONE, revenue: 100, units: 1 },
  { sectionId: OTHER_SECTION_ID, revenue: 50, units: 1 },
]).at(-1), { sectionId: OTHER_SECTION_ID, name: 'Otros', revenue: 150, units: 2 });

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log('\ntodo bien');
