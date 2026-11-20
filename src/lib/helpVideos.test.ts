// Prueba sin dependencias: `node --experimental-strip-types src/lib/helpVideos.test.ts` (Node 22+).
// Qué enlaces de YouTube acepta el superadmin al cargar un video de ayuda.
import { helpSearchKey, helpSectionRank, isHelpSection, youtubeEmbedUrl, youtubeId } from './helpVideos.ts';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n     esperado ${JSON.stringify(expected)}\n     obtuvo   ${JSON.stringify(actual)}`}`);
}

const ID = 'dQw4w9WgXcQ';
eq('enlace de compartir', youtubeId(`https://youtu.be/${ID}`), ID);
eq('enlace de compartir con minuto', youtubeId(`https://youtu.be/${ID}?t=42`), ID);
eq('página del video', youtubeId(`https://www.youtube.com/watch?v=${ID}`), ID);
eq('página con lista y otros parámetros', youtubeId(`https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`), ID);
eq('desde el teléfono', youtubeId(`https://m.youtube.com/watch?v=${ID}`), ID);
eq('Shorts', youtubeId(`https://youtube.com/shorts/${ID}`), ID);
eq('para insertar', youtubeId(`https://www.youtube.com/embed/${ID}`), ID);
eq('sin https', youtubeId(`youtu.be/${ID}`), ID);
eq('el id solo', youtubeId(ID), ID);
eq('con espacios alrededor', youtubeId(`  https://youtu.be/${ID}  `), ID);
eq('otro sitio', youtubeId(`https://vimeo.com/123456789`), null);
eq('dominio que se hace pasar por YouTube', youtubeId(`https://youtube.com.evil.test/watch?v=${ID}`), null);
eq('página del canal, sin video', youtubeId('https://www.youtube.com/@ennea'), null);
eq('id con largo malo', youtubeId('https://youtu.be/abc'), null);
eq('vacío', youtubeId(''), null);
eq('no es texto', youtubeId(42), null);

eq('se ve sin cookies y sin videos de otros canales al final', youtubeEmbedUrl(ID, false), `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1`);
eq('secciones válidas', [isHelpSection('pos'), isHelpSection('general'), isHelpSection('admin')], [true, true, false]);
eq('Primeros pasos va antes que el punto de venta', helpSectionRank('general') < helpSectionRank('pos'), true);
eq('buscar sin tildes', helpSearchKey('Cómo COBRAR en el Salón'), 'como cobrar en el salon');

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log('\ntodas bien');
