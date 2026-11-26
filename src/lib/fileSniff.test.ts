// Prueba sin dependencias: `node --experimental-strip-types src/lib/fileSniff.test.ts` (Node 22+).
// Tipo real de los archivos subidos según sus primeros bytes.
import { allowedFileType, sniffFileType } from './fileSniff.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${expected}, obtuvo ${actual}`}`);
}
const b = (...n: number[]) => new Uint8Array(n);
const text = (s: string) => new TextEncoder().encode(s);

eq('jpeg', sniffFileType(b(0xff, 0xd8, 0xff, 0xe0, 0, 0)), 'image/jpeg');
eq('png', sniffFileType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), 'image/png');
eq('gif', sniffFileType(text('GIF89a....')), 'image/gif');
eq('webp', sniffFileType(text('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
eq('riff que no es webp', sniffFileType(text('RIFF\0\0\0\0WAVEfmt ')), null);
eq('pdf', sniffFileType(text('%PDF-1.7\n')), 'application/pdf');
eq('html disfrazado', sniffFileType(text('<html><script>alert(1)</script>')), null);
eq('svg', sniffFileType(text('<svg xmlns="http://www.w3.org/2000/svg">')), null);
eq('vacío', sniffFileType(b()), null);
eq('pdf donde solo van imágenes', allowedFileType(text('%PDF-1.4'), ['image/jpeg', 'image/png']), null);
eq('png permitido', allowedFileType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), ['image/png']), 'image/png');

if (failed) {
  console.log(`\n${failed} fallo(s)`);
  process.exit(1);
}
