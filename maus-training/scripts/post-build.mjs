// Macht dist/index.html "file://-tauglich": Modul-Script -> normales defer-Script,
// crossorigin entfernen. So startet das Spiel auch per Doppelklick auf index.html.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html');
let html = readFileSync(file, 'utf8');
const before = html;
html = html
  .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
  .replace(/<script type="module" src=/g, '<script defer src=')
  .replace(/ crossorigin(?==|\s|>)/g, '');
if (html === before) console.warn('post-build: nichts ersetzt (schon angepasst?)');
writeFileSync(file, html);
console.log('post-build: dist/index.html angepasst');
