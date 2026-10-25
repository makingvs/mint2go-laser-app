// Schreibt dist/sw.js: lädt beim ersten Besuch alle Dateien der App in den Cache,
// danach läuft die App komplett offline. Aufruf: node scripts/make-sw.mjs (nach "vite build")
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name !== 'sw.js') files.push(path.relative(dist, full).split(path.sep).join('/'));
  }
};
walk(dist);
files.sort();

const hash = crypto.createHash('sha1');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(dist, f)));
const version = hash.digest('hex').slice(0, 10);
const assets = ['./', ...files.filter((f) => f !== 'index.html'), 'index.html'].map((f) => (f === './' ? './' : f.split('/').map(encodeURIComponent).join('/')));

const sw = `// automatisch erzeugt von scripts/make-sw.mjs
const CACHE = 'laser-app-${version}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match('./'))),
  );
});
`;
fs.writeFileSync(path.join(dist, 'sw.js'), sw);
console.log(`Service Worker: ${assets.length} Dateien, Version ${version}`);
