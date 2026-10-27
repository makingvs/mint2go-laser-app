// Schreibt dist/sw.js: lädt beim ersten Besuch alle Dateien der App in den Cache,
// danach läuft die App komplett offline.
// Aufruf: node scripts/make-sw.mjs      (Laser-App, dist/)
//         node scripts/make-sw.mjs 3d   (3D-App, dist/3d/)   -- jeweils nach dem zugehörigen "vite build"
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sub = process.argv[2] ?? ''; // '' = Laser-App, '3d' = 3D-App
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', sub);
// Beide Apps teilen sich (z. B. bei GitHub Pages) denselben Ursprung -> getrennte Cache-Namen
const prefix = sub ? `app-${sub}-` : 'laser-app-';
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!(sub === '' && dir === dist && e.name === '3d')) walk(full); // die 3D-App hat einen eigenen Service Worker
    } else if (e.name !== 'sw.js') files.push(path.relative(dist, full).split(path.sep).join('/'));
  }
};
walk(dist);
files.sort();

const hash = crypto.createHash('sha1');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(dist, f)));
const version = hash.digest('hex').slice(0, 10);
const assets = ['./', ...files.filter((f) => f !== 'index.html'), 'index.html'].map((f) => (f === './' ? './' : f.split('/').map(encodeURIComponent).join('/')));

const sw = `// automatisch erzeugt von scripts/make-sw.mjs
const PREFIX = '${prefix}';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
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
