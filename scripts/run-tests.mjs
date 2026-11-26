// Corre todas las pruebas sin dependencias (src/**/*.test.ts) con Node 22+: `npm test`.
// Incluye el detector de rutas de API abiertas (src/lib/apiRouteGuards.test.ts).
// Sale con código 1 si alguna falla, para poder usarlo antes de subir a develop o main.
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(import.meta.dirname, "..", "src");

function findTests(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findTests(full);
    return name.endsWith(".test.ts") ? [full] : [];
  });
}

const tests = findTests(root).sort();
const failed = [];
for (const file of tests) {
  // transform-types (y no solo strip) porque algunas pruebas importan clases con propiedades en el constructor.
  const run = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", file], { encoding: "utf8" });
  const name = relative(join(root, ".."), file);
  if (run.status === 0) {
    console.log(`ok    ${name}`);
  } else {
    failed.push(name);
    console.log(`FALLA ${name}`);
    console.log((run.stdout + run.stderr).split("\n").filter((l) => !l.startsWith("ok")).join("\n"));
  }
}

console.log(`\n${tests.length - failed.length}/${tests.length} pruebas pasaron`);
if (failed.length) process.exit(1);
