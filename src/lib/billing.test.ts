// Prueba sin dependencias: `node --experimental-strip-types src/lib/billing.test.ts` (Node 22+).
// El programa Restaurantes Fundadores: qué paga cada mes un negocio Premium que entra al programa.
import {
  DEFAULT_PLAN_PRICES,
  DEFAULT_TENANT_BILLING,
  crMidnight,
  founderSchedule,
  periodDueDate,
  priceFor,
  resolveBilling,
  type TenantBilling,
} from './billing.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (esperado ${JSON.stringify(expected)})`}`);
}

const prices = DEFAULT_PLAN_PRICES; // Premium 24 900
// Entra en diciembre 2026: diciembre sin costo, enero a marzo al 50%, desde abril el 20%.
const founder: TenantBilling = { ...DEFAULT_TENANT_BILLING, founderStart: crMidnight(2026, 12, 1) };
const pay = (y: number, m: number, plan = 'premium', b = founder) => priceFor(plan, b, prices, periodDueDate(y, m)).amount;

eq('noviembre (antes de empezar, mientras se configura)', pay(2026, 11), 0);
eq('diciembre, mes 1', pay(2026, 12), 0);
eq('enero, mes 2: 50%', pay(2027, 1), 12500);
eq('febrero, mes 3: 50%', pay(2027, 2), 12500);
eq('marzo, mes 4: 50%', pay(2027, 3), 12500);
eq('abril, mes 5: 20%', pay(2027, 4), 19900);
eq('dos años después, sigue el 20%', pay(2029, 4), 19900);

eq('etiqueta del mes sin costo', priceFor('premium', founder, prices, periodDueDate(2026, 12)).discountLabel, 'Restaurante fundador: mes sin costo');
eq('etiqueta del 50%', priceFor('premium', founder, prices, periodDueDate(2027, 2)).discountLabel, 'Restaurante fundador −50%');
eq('etiqueta del 20%', priceFor('premium', founder, prices, periodDueDate(2027, 5)).discountLabel, 'Restaurante fundador −20%');

// Fechas de fin de cada etapa (las ve el dueño en "Mi plan").
const fmt = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);
eq('el mes sin costo termina el 31/12', fmt(resolveBilling('premium', founder, periodDueDate(2026, 12)).freeUntil), crMidnight(2026, 12, 31).toISOString());
eq('el 50% termina el 31/3', fmt(resolveBilling('premium', founder, periodDueDate(2027, 2)).discountUntil), crMidnight(2027, 3, 31).toISOString());
eq('el 20% no tiene fin', resolveBilling('premium', founder, periodDueDate(2027, 6)).discountUntil, null);

// Fuera de Premium el programa no aplica: paga la lista de su plan.
eq('en Pro paga la lista de Pro', pay(2027, 1, 'pro'), 17900);
// Sin programa, nada cambia.
eq('sin programa paga la lista', pay(2027, 1, 'premium', DEFAULT_TENANT_BILLING), 24900);

// Cruza de año: entra en noviembre.
const nov: TenantBilling = { ...DEFAULT_TENANT_BILLING, founderStart: crMidnight(2026, 11, 1) };
eq('calendario que cruza de año', founderSchedule(nov.founderStart!), {
  free: 'noviembre 2026', halfFrom: 'diciembre 2026', halfTo: 'febrero 2027', foreverFrom: 'marzo 2027',
});
eq('marzo ya va al 20%', pay(2027, 3, 'premium', nov), 19900);

console.log(failed ? `\n${failed} prueba(s) fallaron` : '\nTodo bien');
process.exit(failed ? 1 : 0);
