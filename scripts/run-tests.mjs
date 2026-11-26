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
  // Node 23.6+ quita los tipos solo; Node 26 eliminó --experimental-transform-types, así que el código
  // que importan las pruebas no puede usar propiedades en el constructor, enums ni namespaces.
  const [major, minor] = process.versions.node.split(".").map(Number);
  const flags = major > 23 || (major === 23 && minor >= 6) ? [] : ["--experimental-strip-types"];
  const run = spawnSync(process.execPath, [...flags, "--no-warnings", file], { encoding: "utf8" });
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
