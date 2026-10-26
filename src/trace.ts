// Bild -> Vektor: Ein Foto/Bild wird in Schwarz-Weiß umgewandelt und die Umrisse werden
// nachgezeichnet (Marching Squares). Das Ergebnis sind geschlossene Pfade, die wie jede
// andere Form graviert oder geschnitten werden können.
import { contour, signedArea, simplify, smooth, type Ring, type Shape } from './geometry';

export interface GrayImage {
  w: number;
  h: number;
  /** Helligkeit 0 (schwarz) .. 255 (weiß), zeilenweise */
  data: Uint8Array;
}

export const MAX_TRACE_SIDE = 512;

/** Größe so verkleinern, dass die längere Seite höchstens max Pixel hat. */
export function fitSize(w: number, h: number, max = MAX_TRACE_SIDE): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** RGBA -> Helligkeit; transparente Stellen gelten als weiß. */
export function grayFromRGBA(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): GrayImage {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const lum = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { w, h, data };
}

/** Automatischer Schwellwert nach Otsu (trennt dunkel und hell am besten). */
export function otsu(img: GrayImage): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of img.data) hist[v]++;
  const total = img.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let first = 128;
  let last = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best * 1.0001) {
      best = between;
      first = last = t;
    } else if (between >= best * 0.9999) last = t; // gleich gut: Mitte des Plateaus nehmen
  }
  return Math.min(250, Math.max(5, Math.round((first + last) / 2) + 1)); // dunkel = Helligkeit < Schwellwert
}

/** Anteil der Pixel, die bei diesem Schwellwert "Vordergrund" (dunkel) sind. */
export function darkFraction(img: GrayImage, threshold: number): number {
  let n = 0;
  for (const v of img.data) if (v < threshold) n++;
  return n / img.data.length;
}

function blur(img: GrayImage): Float32Array {
  const { w, h, data } = img;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          s += data[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

export interface TraceOptions {
  /** 1..254: dunkler als dieser Wert = Vordergrund (bei invert: heller) */
  threshold: number;
  invert?: boolean;
  /** Flecken kleiner als dieser Anteil der Bildfläche werden ignoriert */
  minAreaFraction?: number;
}

/** Umrisse als Ringe in Pixelkoordinaten (y nach unten); Löcher ergeben sich per Even-Odd. */
export function traceGray(img: GrayImage, opts: TraceOptions): Shape {
  const { w, h } = img;
  const g = blur(img);
  const sign = opts.invert ? -1 : 1;
  const field = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 1000; // Rand ist immer "außen"
    return sign * (g[y * w + x] - opts.threshold);
  };
  const raw = contour(field, { minX: -1, minY: -1, maxX: w, maxY: h }, 1);
  const minArea = (opts.minAreaFraction ?? 0.0002) * w * h;
  const rings: Ring[] = [];
  for (const r of raw) {
    if (Math.abs(signedArea(r)) < Math.max(minArea, 6)) continue;
    const dense = smooth(r, 2, true); // Pixeltreppen glätten, solange viele Punkte vorhanden sind
    const s = simplify([...dense, dense[0]], 0.6);
    s.pop();
    if (s.length < 3) continue;
    rings.push(s);
  }
  return rings;
}
