// Kopiert die Lizenztexte der mitgelieferten Schriften (aus node_modules) nach public/licenses/,
// damit sie mit der App ausgeliefert werden (SIL OFL 1.1 verlangt, dass Urheberhinweis und Lizenz
// jeder weitergegebenen Schrift beiliegen). Aufruf: node scripts/copy-licenses.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'licenses');
fs.mkdirSync(out, { recursive: true });

const FONTS = [
  ['jost', 'Jost', '@fontsource-variable/jost'],
  ['fredoka', 'Fredoka', '@fontsource-variable/fredoka'],
  ['baloo', 'Baloo 2', '@fontsource-variable/baloo-2'],
  ['rubik', 'Rubik Mono One', '@fontsource/rubik-mono-one'],
  ['bangers', 'Bangers', '@fontsource/bangers'],
  ['caveat', 'Caveat', '@fontsource-variable/caveat'],
  ['pacifico', 'Pacifico', '@fontsource/pacifico'],
];

for (const [id, name, pkg] of FONTS) {
  const dir = path.join(root, 'node_modules', pkg);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const text = fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8');
  const header = `Schrift: ${name}\nWeitergegeben über das npm-Paket ${pkg} ${meta.version} (Lizenz laut Paket: ${meta.license})\n${'='.repeat(70)}\n\n`;
  fs.writeFileSync(path.join(out, `font-${id}.txt`), header + text);
}
console.log(`Lizenztexte geschrieben: ${FONTS.length} Schriften -> ${out}`);
