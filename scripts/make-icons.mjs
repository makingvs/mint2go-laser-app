// Erzeugt das App-Symbol (MINT2Go-Zahnräder) für den Home-Bildschirm (public/apple-touch-icon.png, icon-512.png).
// Aufruf: node scripts/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
fs.mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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

// Zahnräder im MINT2Go-Stil (Farben aus dem Logo)
function gearRadius(theta, R, teeth) {
  const pitch = (Math.PI * 2) / teeth;
  const t = Math.abs((((theta % pitch) + pitch) % pitch) / pitch - 0.5) * 2; // 0 = Zahnmitte
  const root = R * 0.78;
  if (t < 0.38) return R;
  if (t < 0.62) return R + (root - R) * ((t - 0.38) / 0.24);
  return root;
}
function inGear(u, v, g, grow = 0) {
  const dx = u - g.x;
  const dy = v - g.y;
  const r = Math.hypot(dx, dy);
  const rad = g.teeth ? gearRadius(Math.atan2(dy, dx), g.R, g.teeth) : g.R;
  return r < rad + grow && r > g.hole - grow * 0;
}
const GEARS = [
  { x: 0.35, y: 0.6, R: 0.3, teeth: 12, hole: 0.09, color: [56, 184, 232] },
  { x: 0.64, y: 0.33, R: 0.25, teeth: 10, hole: 0.085, color: [240, 160, 48] },
  { x: 0.7, y: 0.74, R: 0.17, teeth: 0, hole: 0.06, color: [224, 16, 112] },
];

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 3;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 2 - 1;
          const v = ((y + (sy + 0.5) / SS) / size) * 2 - 1;
          let c = [255, 255, 255];
          for (const g of GEARS) {
            if (inGear(u * 0.5 + 0.5, v * 0.5 + 0.5, g, 0.022)) c = [255, 255, 255];
            if (inGear(u * 0.5 + 0.5, v * 0.5 + 0.5, g)) c = g.color;
          }
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r / (SS * SS); raw[i + 1] = g / (SS * SS); raw[i + 2] = b / (SS * SS); raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), png(180));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512));
console.log('Symbole erzeugt in', out);
