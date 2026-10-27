// Erzeugt QR-Codes (SVG + PNG) ohne Fremdbibliothek: Byte-Modus, Fehlerkorrektur M, Version 1-5 (bis 106 Zeichen).
// Aufruf: node scripts/make-qr.mjs <Adresse> <Ausgabe ohne Endung> [Größe in Pixeln]
//   z. B.  node scripts/make-qr.mjs https://makingvs.github.io/mint2go-laser-app/3d/ docs/qr-3d-app
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------- Galois-Feld und Reed-Solomon ----------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsRemainder(data, ecLen) {
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((c, j) => {
      next[j] ^= c;
      next[j + 1] ^= mul(c, EXP[i]);
    });
    gen = next;
  }
  const rem = new Array(ecLen).fill(0);
  for (const b of data) {
    const f = b ^ rem.shift();
    rem.push(0);
    if (f) gen.slice(1).forEach((c, j) => (rem[j] ^= mul(c, f)));
  }
  return rem;
}

// Fehlerkorrektur M: je Version Blöcke [Anzahl, Datenbytes] und Korrekturbytes je Block
const VERSIONS = [
  null,
  { blocks: [[1, 16]], ec: 10, align: [] },
  { blocks: [[1, 28]], ec: 16, align: [6, 18] },
  { blocks: [[1, 44]], ec: 26, align: [6, 22] },
  { blocks: [[2, 32]], ec: 18, align: [6, 26] },
  { blocks: [[2, 43], [2, 44]], ec: 24, align: [6, 30] },
];
const dataBytes = (v) => v.blocks.reduce((a, [n, d]) => a + n * d, 0);

function encodeData(text) {
  const bytes = [...new TextEncoder().encode(text)];
  const version = VERSIONS.findIndex((v, i) => v && bytes.length + 2 <= dataBytes(v) && i > 0);
  if (version < 1) throw new Error(`Text zu lang (${bytes.length} Bytes, höchstens ${dataBytes(VERSIONS[5]) - 2})`);
  const v = VERSIONS[version];
  const bits = [];
  const put = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, 8);
  bytes.forEach((b) => put(b, 8));
  const cap = dataBytes(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  // in Blöcke teilen, Korrekturbytes berechnen, abwechselnd zusammenfügen
  const blocks = [];
  let pos = 0;
  for (const [n, d] of v.blocks) for (let i = 0; i < n; i++, pos += d) blocks.push(data.slice(pos, pos + d));
  const ecs = blocks.map((b) => rsRemainder(b, v.ec));
  const out = [];
  for (let i = 0; i < Math.max(...blocks.map((b) => b.length)); i++) blocks.forEach((b) => i < b.length && out.push(b[i]));
  for (let i = 0; i < v.ec; i++) ecs.forEach((e) => out.push(e[i]));
  return { version, bytes: out };
}

// ---------- Matrix ----------
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function formatBits(mask) {
  const data = (0b00 << 3) | mask; // Fehlerkorrektur M = 00
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

function build(text) {
  const { version, bytes } = encodeData(text);
  const v = VERSIONS[version];
  const n = 17 + 4 * version;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false)); // Funktionsmodule
  const set = (r, c, dark) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    m[r][c] = dark;
    fn[r][c] = true;
  };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(r0 + r, c0 + c, dark);
      }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const al = v.align;
  for (const r of al)
    for (const c of al) {
      if (fn[r][c]) continue; // überlappt Suchmuster
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  set(n - 8, 8, true); // dunkles Modul
  // Platz für die Formatinformation freihalten
  for (let i = 0; i < 9; i++) {
    if (!fn[8][i]) set(8, i, false);
    if (!fn[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!fn[8][n - 1 - i]) set(8, n - 1 - i, false);
    if (!fn[n - 1 - i][8]) set(n - 1 - i, 8, false);
  }
  // Daten im Zickzack von unten rechts einsetzen
  const bits = [];
  bytes.forEach((b) => {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  });
  while (bits.length % 8 || bits.length < 0) bits.push(0);
  const slots = [];
  for (let c = n - 1, up = true; c > 0; c -= 2, up = !up) {
    if (c === 6) c--;
    for (let i = 0; i < n; i++) {
      const r = up ? n - 1 - i : i;
      for (const cc of [c, c - 1]) if (!fn[r][cc]) slots.push([r, cc]);
    }
  }
  const raw = m.map((row) => row.slice());
  slots.forEach(([r, c], i) => (raw[r][c] = (bits[i] ?? 0) === 1));

  const withMask = (k) => {
    const g = raw.map((row) => row.slice());
    for (const [r, c] of slots) if (MASKS[k](r, c)) g[r][c] = !g[r][c];
    const f = formatBits(k);
    for (let i = 0; i < 15; i++) {
      const dark = ((f >> i) & 1) === 1;
      // erste Kopie um das linke obere Suchmuster
      if (i < 6) g[i][8] = dark;
      else if (i < 8) g[i + 1][8] = dark;
      else if (i < 9) g[8][7] = dark;
      else g[8][14 - i] = dark;
      // zweite Kopie unten links und oben rechts
      if (i < 8) g[8][n - 1 - i] = dark;
      else g[n - 15 + i][8] = dark;
    }
    return g;
  };
  let best = null;
  for (let k = 0; k < 8; k++) {
    const g = withMask(k);
    const p = penalty(g);
    if (!best || p < best.p) best = { g, p, k };
  }
  return best.g;
}

function penalty(g) {
  const n = g.length;
  let p = 0;
  const run = (line) => {
    let s = 0;
    for (let i = 0, len = 1; i < n; i++) {
      if (i + 1 < n && line[i + 1] === line[i]) len++;
      else {
        if (len >= 5) s += 3 + (len - 5);
        len = 1;
      }
    }
    return s;
  };
  for (let i = 0; i < n; i++) {
    p += run(g[i]);
    p += run(g.map((row) => row[i]));
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
  const pat = [true, false, true, true, true, false, true, false, false, false, false];
  const rev = [...pat].reverse();
  const match = (get, i, q) => q.every((d, k) => get(i + k) === d);
  for (let a = 0; a < n; a++)
    for (let i = 0; i + 11 <= n; i++) {
      for (const q of [pat, rev]) {
        if (match((k) => g[a][k], i, q)) p += 40;
        if (match((k) => g[k][a], i, q)) p += 40;
      }
    }
  const dark = g.flat().filter(Boolean).length;
  p += 10 * Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5);
  return p;
}

// ---------- Ausgabe ----------
const QUIET = 4;
const FG = '#2F3A5F';

export function qrMatrix(text) {
  return build(text);
}

export function toSvg(g) {
  const n = g.length + 2 * QUIET;
  let d = '';
  g.forEach((row, r) => {
    for (let c = 0; c < row.length; ) {
      if (!row[c]) {
        c++;
        continue;
      }
      let e = c;
      while (e < row.length && row[e]) e++;
      d += `M${c + QUIET} ${r + QUIET + 0.5}h${e - c}`;
      c = e;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path fill="#FFFFFF" d="M0 0h${n}v${n}H0z"/><path stroke="${FG}" d="${d}"/></svg>\n`;
}

const crcTable = Array.from({ length: 256 }, (_, k) => {
  let c = k;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

export function toPng(g, size = 1024) {
  const n = g.length + 2 * QUIET;
  const scale = Math.max(1, Math.floor(size / n));
  const px = n * scale;
  const fg = [0x2f, 0x3a, 0x5f];
  const rows = [];
  for (let y = 0; y < px; y++) {
    const row = Buffer.alloc(1 + px * 3, 255);
    row[0] = 0;
    const r = Math.floor(y / scale) - QUIET;
    for (let x = 0; x < px; x++) {
      const c = Math.floor(x / scale) - QUIET;
      if (r >= 0 && c >= 0 && r < g.length && c < g.length && g[r][c]) fg.forEach((v, k) => (row[1 + x * 3 + k] = v));
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [, , url, out, size] = process.argv;
  if (!url || !out) {
    console.error('Aufruf: node scripts/make-qr.mjs <Adresse> <Ausgabe ohne Endung> [Pixel]');
    process.exit(1);
  }
  const g = build(url);
  const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', out);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  fs.writeFileSync(`${base}.svg`, toSvg(g));
  fs.writeFileSync(`${base}.png`, toPng(g, Number(size) || 1024));
  console.log(`${url} -> ${out}.svg/.png (${g.length}x${g.length} Module)`);
}
