// Packt den Ordner Grafiken/<Thema>/*.svg in die App (public/library/), damit die Bilder
// mit der verteilten App ausgeliefert werden und offline funktionieren.
// Aufruf: node scripts/build-library.mjs   (läuft automatisch bei "npm run build")
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'Grafiken');
const out = path.join(root, 'public', 'library');
const MAX_SVG = 2 * 1024 * 1024;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const splitName = (name) => {
  const m = /^(\p{Extended_Pictographic}️?)\s*(.*)$/u.exec(name);
  return m ? { icon: m[1], name: m[2] || name } : { icon: '🖼️', name };
};

const themes = [];
const collect = (dir, themeName) => {
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.svg'))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .slice(0, 300);
  const id = `t${themes.length}`;
  const list = [];
  files.forEach((f, i) => {
    const text = fs.readFileSync(path.join(dir, f.name), 'utf8');
    if (text.length > MAX_SVG || !/<svg[\s>]/.test(text.slice(0, 4000)) || /<script/i.test(text)) {
      console.warn(`  übersprungen (ungültig/zu groß/Skript): ${path.join(themeName || '.', f.name)}`);
      return;
    }
    fs.mkdirSync(path.join(out, id), { recursive: true });
    fs.writeFileSync(path.join(out, id, `f${i}.svg`), text);
    list.push({ path: `${id}/f${i}.svg`, name: f.name.replace(/\.svg$/i, '') });
  });
  if (list.length) themes.push({ id, ...(themeName ? splitName(themeName) : { icon: '🖼️', name: 'Eigene' }), files: list });
};

if (fs.existsSync(src)) {
  const dirs = fs.readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  for (const d of dirs) collect(path.join(src, d.name), d.name);
  collect(src, '');
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ themes }));
console.log(`Bibliothek: ${themes.length} Thema/Themen, ${themes.reduce((n, t) => n + t.files.length, 0)} Bild(er)`);
