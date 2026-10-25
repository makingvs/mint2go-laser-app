// Kleiner Server für den Windows-PC am Laser.
// Liefert die Web-App aus (dist/), nimmt SVG-Dateien an (Laser-Eingang/)
// und speichert die Arbeiten der Kinder (Projekte/<Kind>/).
// Keine externen Abhängigkeiten – nur Node.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const MAX_BODY = 8 * 1024 * 1024;
const MAX_SVG = 2 * 1024 * 1024;

export const DEFAULT_SETTINGS = {
  plate: { width: 300, height: 200 },
  colors: { cut: '#FF0000', engrave: '#0000FF', fill: '#000000' },
  minSize: 3,
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

/** Macht aus beliebigem Text einen sicheren Datei-/Ordnernamen. */
export function safeName(text, fallback = 'Kind') {
  const s = String(text ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return s || fallback;
}

/** Wie safeName, erlaubt aber Emoji (Themenordner wie "🐾 Tiere"). */
export function safeFolderName(text, fallback = 'Eigene') {
  const s = String(text ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}_ \-\p{Extended_Pictographic}️]/gu, '')
    .trim()
    .slice(0, 40);
  return s || fallback;
}

export function timestampName(name, date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  const t = `${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
  return `${safeName(name)}_${d}_${t}.svg`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('zu groß'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function mergeSettings(input) {
  const s = input && typeof input === 'object' ? input : {};
  const num = (v, d, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const col = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : d);
  return {
    plate: {
      width: num(s.plate?.width, DEFAULT_SETTINGS.plate.width, 20, 1000),
      height: num(s.plate?.height, DEFAULT_SETTINGS.plate.height, 20, 1000),
    },
    colors: {
      cut: col(s.colors?.cut, DEFAULT_SETTINGS.colors.cut),
      engrave: col(s.colors?.engrave, DEFAULT_SETTINGS.colors.engrave),
      fill: col(s.colors?.fill, DEFAULT_SETTINGS.colors.fill),
    },
    minSize: num(s.minSize, DEFAULT_SETTINGS.minSize, 0, 50),
  };
}

/**
 * Baut den HTTP-Server. root = Ordner, in dem Laser-Eingang/, Projekte/ und
 * einstellungen.json liegen; distDir = gebaute Web-App.
 */
export function createApp({ root, distDir }) {
  const inbox = path.join(root, 'Laser-Eingang');
  const projects = path.join(root, 'Projekte');
  const settingsFile = path.join(root, 'einstellungen.json');
  fs.mkdirSync(inbox, { recursive: true });
  fs.mkdirSync(projects, { recursive: true });

  const library = path.join(root, 'Grafiken');
  fs.mkdirSync(library, { recursive: true });

  const profileDir = (id) => path.join(projects, safeName(id));

  /** Offene SVG-Bibliothek: Grafiken/<Thema>/*.svg (lose Dateien gehören zum Thema "Eigene"). */
  function listLibrary() {
    const themes = [];
    const scan = (dir, themeId) => {
      const files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.svg'))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .slice(0, 300)
        .map((f) => ({ path: themeId ? `${themeId}/${f.name}` : f.name, name: f.name.replace(/\.svg$/i, '') }));
      return files;
    };
    for (const entry of fs.readdirSync(library, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const files = scan(path.join(library, entry.name), entry.name);
      if (!files.length) continue;
      const m = /^(\p{Extended_Pictographic}️?)\s*(.*)$/u.exec(entry.name);
      themes.push({ id: entry.name, icon: m ? m[1] : '🖼️', name: m ? m[2] || entry.name : entry.name, files });
    }
    const loose = scan(library, '');
    if (loose.length) themes.push({ id: '', icon: '🖼️', name: 'Eigene', files: loose });
    themes.sort((a, b) => a.id.localeCompare(b.id, 'de'));
    return themes;
  }

  function checkSvgText(body) {
    if (body.length > MAX_SVG) return 'zu groß';
    if (!/<svg[\s>]/.test(body.slice(0, 4000))) return 'kein SVG';
    if (/<script/i.test(body)) return 'Skripte nicht erlaubt';
    return null;
  }

  async function api(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // ['api', ...]
    const method = req.method;
    const route = parts.slice(1);

    if (route[0] === 'ping') return sendJson(res, 200, { ok: true, time: Date.now() });

    if (route[0] === 'info') {
      const port = req.socket.localPort;
      const addresses = localAddresses().map((a) => ({ name: a.name, url: `http://${a.address}:${port}` }));
      addresses.push({ name: 'Name', url: `http://${os.hostname().toLowerCase()}.local:${port}` });
      return sendJson(res, 200, { hostname: os.hostname(), addresses });
    }

    if (route[0] === 'settings') {
      if (method === 'GET') return sendJson(res, 200, mergeSettings(readJsonFile(settingsFile, {})));
      if (method === 'PUT') {
        const merged = mergeSettings(JSON.parse(await readBody(req)));
        fs.writeFileSync(settingsFile, JSON.stringify(merged, null, 2));
        return sendJson(res, 200, merged);
      }
    }

    if (route[0] === 'library') {
      if (route.length === 1 && method === 'GET') return sendJson(res, 200, listLibrary());
      if (route[1] === 'file' && method === 'GET') {
        const full = path.resolve(library, url.searchParams.get('path') ?? '');
        if (!full.startsWith(library + path.sep) || !full.toLowerCase().endsWith('.svg') || !fs.existsSync(full)) {
          return sendJson(res, 404, { error: 'nicht gefunden' });
        }
        if (fs.statSync(full).size > MAX_SVG) return sendJson(res, 413, { error: 'zu groß' });
        res.writeHead(200, {
          'Content-Type': 'image/svg+xml',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(full).pipe(res);
        return;
      }
      if (route[1] === 'upload' && method === 'POST') {
        const body = await readBody(req);
        const problem = checkSvgText(body);
        if (problem) return sendJson(res, 400, { ok: false, error: problem });
        const theme = safeFolderName(url.searchParams.get('theme') || 'Eigene');
        const name = safeName((url.searchParams.get('name') || 'bild').replace(/\.svg$/i, ''), 'bild');
        const dir = path.join(library, theme);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${name}.svg`), body, 'utf8');
        return sendJson(res, 200, { ok: true, path: `${theme}/${name}.svg` });
      }
    }

    if (route[0] === 'send' && method === 'POST') {
      const body = await readBody(req);
      if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(body)) return sendJson(res, 400, { ok: false, error: 'kein SVG' });
      const file = timestampName(url.searchParams.get('kind') || 'Kind');
      fs.writeFileSync(path.join(inbox, file), body, 'utf8');
      return sendJson(res, 200, { ok: true, file });
    }

    if (route[0] === 'profiles') {
      if (route.length === 1) {
        if (method === 'GET') {
          const list = [];
          for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const meta = readJsonFile(path.join(projects, entry.name, 'profil.json'), null);
            list.push({ id: entry.name, name: meta?.name ?? entry.name, icon: meta?.icon ?? '🙂' });
          }
          list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
          return sendJson(res, 200, list);
        }
        if (method === 'POST') {
          const data = JSON.parse(await readBody(req));
          const id = safeName(data.name || data.iconName || 'Kind');
          const dir = profileDir(id);
          fs.mkdirSync(dir, { recursive: true });
          const metaFile = path.join(dir, 'profil.json');
          const meta = readJsonFile(metaFile, null) ?? { name: String(data.name || id).slice(0, 40), icon: String(data.icon || '🙂').slice(0, 8) };
          fs.writeFileSync(metaFile, JSON.stringify(meta));
          return sendJson(res, 200, { id, ...meta });
        }
      }
      if (route.length >= 3 && route[2] === 'designs') {
        const dir = profileDir(route[1]);
        if (!fs.existsSync(dir)) return sendJson(res, 404, { error: 'unbekannt' });
        if (route.length === 3 && method === 'GET') {
          const out = [];
          for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.json') || f === 'profil.json') continue;
            const d = readJsonFile(path.join(dir, f), null);
            if (d && d.id) out.push(d);
          }
          out.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
          return sendJson(res, 200, out);
        }
        if (route.length === 4) {
          const did = safeName(route[3], 'arbeit');
          const file = path.join(dir, `${did}.json`);
          if (method === 'PUT') {
            const data = JSON.parse(await readBody(req));
            data.id = did;
            fs.writeFileSync(file, JSON.stringify(data));
            return sendJson(res, 200, { ok: true });
          }
          if (method === 'DELETE') {
            // Nicht endgültig löschen: in den Papierkorb verschieben.
            if (fs.existsSync(file)) {
              const trash = path.join(dir, '_Papierkorb');
              fs.mkdirSync(trash, { recursive: true });
              fs.renameSync(file, path.join(trash, `${did}_${Date.now()}.json`));
            }
            return sendJson(res, 200, { ok: true });
          }
        }
      }
    }
    return sendJson(res, 404, { error: 'nicht gefunden' });
  }

  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(distDir, rel));
    if (!file.startsWith(path.normalize(distDir))) {
      res.writeHead(403).end();
      return;
    }
    let target = file;
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(distDir, 'index.html');
    if (!fs.existsSync(target)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Die App ist noch nicht gebaut. Bitte "npm run build" ausführen.');
      return;
    }
    const type = MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      return serveStatic(req, res, url);
    } catch (err) {
      const status = err?.status ?? (err instanceof SyntaxError ? 400 : 500);
      if (!res.headersSent) sendJson(res, status, { ok: false, error: String(err?.message ?? err) });
      else res.end();
    }
  });
}

/** Adressen, unter denen iPads im WLAN/LAN den PC erreichen (ohne Link-Local und VPN wie Tailscale). */
export function localAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      const [a, b] = i.address.split('.').map(Number);
      if (a === 169 && b === 254) continue; // keine echte Verbindung
      if (a === 100 && b >= 64 && b <= 127) continue; // VPN (CGNAT, z. B. Tailscale)
      out.push({ name, address: i.address });
    }
  }
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(here, '..');
  const port = Number(process.env.PORT) || 3000;
  const server = createApp({ root, distDir: path.join(root, 'dist') });
  server.listen(port, '0.0.0.0', () => {
    console.log('==============================================');
    console.log(' Laser-Zeichen-App läuft.');
    console.log(' Auf dem iPad (im selben WLAN) in Safari öffnen:');
    const addrs = localAddresses();
    for (const a of addrs) console.log(`   http://${a.address}:${port}    (${a.name})`);
    console.log(`   oder per Name: http://${os.hostname().toLowerCase()}.local:${port}`);
    console.log(`   (auf diesem PC: http://localhost:${port})`);
    if (!addrs.length) console.log(' ACHTUNG: Keine Netzwerkverbindung gefunden. Ist der PC mit dem WLAN verbunden?');
    console.log(' Erreichen die iPads den PC nicht: wlan-einrichten.bat als Administrator ausführen.');
    console.log(` Gesendete Dateien: ${path.join(root, 'Laser-Eingang')}`);
    console.log(' Dieses Fenster offen lassen. Beenden mit Strg+C.');
    console.log('==============================================');
  });
}
