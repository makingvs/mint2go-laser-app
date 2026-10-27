// Zieht aus src/style.css die Regeln für Profil-/Galerie-/Lehrkraft-Bildschirme und schreibt sie nach
// app3d/src/shared.css (damit die 3D-App dasselbe Aussehen hat, ohne die ganze Laser-CSS zu laden).
// Aufruf: node scripts/extract-css.mjs   (nur nötig, wenn sich diese Teile der Laser-CSS ändern)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8').replace(/\r\n/g, '\n');

// Klassen, deren Regeln übernommen werden (Auswahl enthält eine davon als eigenständige Klasse)
const CLASSES = [
  'screen', 'profile-screen', 'gallery-screen', 'logo', 'logo-img', 'decor', 'decor-svg', 'card-grid', 'card', 'profile-card', 'add-card',
  'wide', 'emoji', 'cap', 'work-card', 'work-open', 'work-actions', 'work-del', 'work-export', 'who', 'gallery-head', 'info-btn', 'warn-banner',
  'pick-grid', 'pick-item', 'animals', 'used', 'teacher', 'tform', 'trow', 'tform-block', 'chip', 'presets', 'hint', 'error-box', 'fail-icon',
  'cd-line', 'cd-wrap', 'dot', 'seg', 'ring', 'lic-panel', 'lic-body', 'lic-card', 'lic-title', 'lic-meta', 'lic-url', 'lic-text',
];
const classRe = new RegExp(`\\.(${CLASSES.join('|')})(?![\\w-])`);

/** Zerlegt CSS in oberste Blöcke: { head, body|null, text } */
function blocks(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    const semi = src.indexOf(';', i);
    if (open < 0) break;
    if (semi >= 0 && semi < open && src.slice(i, semi).trim().startsWith('@')) {
      out.push({ head: src.slice(i, semi).trim(), body: null, text: src.slice(i, semi + 1).trim() });
      i = semi + 1;
      continue;
    }
    let depth = 0;
    let j = open;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) break;
    }
    out.push({ head: src.slice(i, open).trim().replace(/\/\*[\s\S]*?\*\/\s*/g, ''), body: src.slice(open + 1, j), text: src.slice(i, j + 1).trim() });
    i = j + 1;
  }
  return out;
}

const wanted = (selector) => selector.split(',').some((s) => classRe.test(s));
const kept = [];
const keyframes = new Map();
for (const b of blocks(css)) {
  if (b.head.startsWith('@keyframes')) {
    keyframes.set(b.head.split(/\s+/)[1], b.text);
  } else if (b.head.startsWith('@media')) {
    const inner = blocks(b.body).filter((r) => wanted(r.head));
    if (inner.length) kept.push(`${b.head} {\n${inner.map((r) => '  ' + r.text.replace(/\n/g, '\n  ')).join('\n')}\n}`);
  } else if (b.head.startsWith('@')) {
    continue; // @font-face u. ä. nicht
  } else if (wanted(b.head)) {
    kept.push(b.text);
  }
}
const body = kept.join('\n');
const used = [...keyframes].filter(([name]) => new RegExp(`[: ,]${name}[ ;,]`).test(body)).map(([, text]) => text);
const header = '/* Automatisch aus src/style.css erzeugt (node scripts/extract-css.mjs): Profil, Galerie, Lehrkraft, Lizenzen. Nicht von Hand ändern. */\n';
fs.writeFileSync(path.join(root, 'app3d', 'src', 'shared.css'), `${header}${body}\n${used.join('\n')}\n`);
console.log(`shared.css: ${kept.length} Regeln, ${used.length} Animationen`);
