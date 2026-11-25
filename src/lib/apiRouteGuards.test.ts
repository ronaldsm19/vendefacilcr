// Prueba sin dependencias: `node --experimental-strip-types src/lib/apiRouteGuards.test.ts` (Node 22+).
// Detector de rutas de API abiertas: cada route.ts bajo src/app/api tiene que pedir sesión
// (negocio, superadmin, agente de impresión o secreto del cron). Las que son públicas a propósito
// van en PUBLIC_ROUTES con el motivo. Una ruta nueva sin guardia hace fallar esta prueba: así
// apareció /api/products, abierta desde antes del multi-tenant y con un POST que borraba el catálogo.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const API_DIR = join(import.meta.dirname, '..', 'app', 'api');

const GUARDS = [
  /\bgetSession(Payload)?\s*\(/,
  /\bgetSuperadminSession\s*\(/,
  /\bauthenticateAgent\s*\(/,
  /process\.env\.CRON_SECRET/,
];

// Ruta (relativa a src/app/api, sin /route.ts) → por qué no lleva sesión.
const PUBLIC_ROUTES: Record<string, string> = {
  'admin/auth/login': 'login web del negocio; límite de intentos en server/services/auth',
  'admin/auth/logout': 'solo borra la cookie',
  'auth/token': 'login de la app móvil; mismo límite de intentos que la web',
  'auth/refresh': 'canjea un refresh token; el token es la credencial',
  'auth/logout': 'revoca el refresh token que trae',
  'superadmin/auth/login': 'login del superadmin; con límite de intentos',
  'superadmin/auth/logout': 'solo borra la cookie',
  'superadmin/setup': 'protegida por SUPERADMIN_SETUP_SECRET',
  'app-invites/[code]': 'canje del QR de la app antes de tener sesión; límite por IP',
  'products/[id]/click': 'conteo de clics de la tienda pública',
  'products': 'cerrada: responde 410 a todo',
  'health': 'chequeo de vida',
};

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === 'route.ts' ? [full] : [];
  });
}

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     ${detail}`}`);
}

const seen = new Set<string>();
for (const file of routeFiles(API_DIR)) {
  const route = relative(API_DIR, file).split(sep).slice(0, -1).join('/');
  seen.add(route);
  const source = readFileSync(file, 'utf8');
  const guarded = GUARDS.some((re) => re.test(source));
  if (guarded) continue;
  check(
    `/api/${route} sin sesión`,
    route in PUBLIC_ROUTES,
    'no llama a ninguna guardia: agregá getSession/getSuperadminSession/authenticateAgent, o anotala en PUBLIC_ROUTES con el motivo'
  );
}

// Una entrada que ya no existe en disco es una excepción olvidada: limpiarla.
for (const route of Object.keys(PUBLIC_ROUTES)) {
  check(`PUBLIC_ROUTES: /api/${route} existe`, seen.has(route), 'la ruta ya no existe; quitala de la lista');
}

console.log(`\n${seen.size} rutas revisadas`);
if (failed) {
  console.log(`${failed} fallo(s)`);
  process.exit(1);
}
