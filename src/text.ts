// Eigene dicke Blockschrift (nur Großbuchstaben): keine Schriftdatei, keine Lizenz,
// der Text liegt von Anfang an als Pfad vor. Jeder Buchstabe ist eine Mittellinie,
// die per Abstandsfeld zu einem dicken Umriss mit runden Enden wird.
import { bbox, contour, simplify, normalizeShape, type Pt, type Ring, type Shape } from './geometry';

type Stroke = Pt[];

export const STROKE_R = 0.75; // halbe Strichdicke in Glyphen-Einheiten
export const CAP_HEIGHT = 6; // Höhe der Mittellinien
/** Sichtbare Höhe eines Großbuchstabens in Glyphen-Einheiten */
export const GLYPH_HEIGHT = CAP_HEIGHT + 2 * STROKE_R;

function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 18): Stroke {
  const out: Stroke = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

const dot = (x: number, y: number): Stroke => [[x, y], [x, y]];
const join = (...parts: Stroke[]): Stroke => parts.flat();
const flip180 = (strokes: Stroke[], cx: number, cy: number): Stroke[] =>
  strokes.map((s) => s.map(([x, y]) => [2 * cx - x, 2 * cy - y] as Pt));

const A: Stroke[] = [[[0, 6], [2.2, 0], [4.4, 6]], [[0.8, 4], [3.6, 4]]];
const O: Stroke[] = [arc(2.2, 3, 2.2, 3, 0, 360, 28)];
const P: Stroke = join([[0, 6], [0, 0], [2.3, 0]], arc(2.3, 1.7, 1.7, 1.7, -90, 90), [[0, 3.4]]);
const U: Stroke = join([[0, 0], [0, 3.6]], arc(2.2, 3.6, 2.2, 2.4, 180, 0), [[4.4, 0]]);
const SIX: Stroke[] = [arc(2.2, 4, 2.1, 2, 0, 360, 24), [[3.6, 0.3], [1.3, 0.9], [0.2, 3.2], [0.1, 4]]];

const GLYPHS: Record<string, Stroke[]> = {
  A,
  B: [join([[0, 0], [0, 6]]), join([[0, 0], [2.4, 0]], arc(2.4, 1.5, 1.5, 1.5, -90, 90), [[0, 3]]), join([[0, 3], [2.6, 3]], arc(2.6, 4.5, 1.5, 1.5, -90, 90), [[0, 6]])],
  C: [arc(2.3, 3, 2.3, 3, -40, -320, 24)],
  D: [join([[0, 0], [0, 6]]), join([[0, 0], [1.8, 0]], arc(1.8, 3, 2.4, 3, -90, 90), [[0, 6]])],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3.2, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3.2, 3]]],
  G: [join(arc(2.3, 3, 2.3, 3, -40, -360, 26), [[2.4, 3]])],
  H: [[[0, 0], [0, 6]], [[4.2, 0], [4.2, 6]], [[0, 3], [4.2, 3]]],
  I: [[[-1, 0], [1, 0]], [[0, 0], [0, 6]], [[-1, 6], [1, 6]]],
  J: [join([[3.2, 0], [3.2, 3.8]], arc(1.6, 3.8, 1.6, 2.2, 0, 165))],
  K: [[[0, 0], [0, 6]], [[3.8, 0], [0, 3.4]], [[1.2, 2.4], [4, 6]]],
  L: [[[0, 0], [0, 6], [3.8, 6]]],
  M: [[[0, 6], [0, 0], [2.5, 3.8], [5, 0], [5, 6]]],
  N: [[[0, 6], [0, 0], [4.2, 6], [4.2, 0]]],
  O,
  P: [P],
  Q: [...O, [[2.6, 4.4], [4.6, 6.6]]],
  R: [P, [[1.8, 3.4], [4.1, 6]]],
  S: [join(arc(2.2, 1.5, 2.0, 1.5, -30, -270, 18), arc(2.2, 4.5, 2.2, 1.5, -90, 150, 18))],
  T: [[[0, 0], [4.6, 0]], [[2.3, 0], [2.3, 6]]],
  U: [U],
  V: [[[0, 0], [2.3, 6], [4.6, 0]]],
  W: [[[0, 0], [1.3, 6], [3, 1.8], [4.7, 6], [6, 0]]],
  X: [[[0, 0], [4.2, 6]], [[4.2, 0], [0, 6]]],
  Y: [[[0, 0], [2.2, 3]], [[4.4, 0], [2.2, 3], [2.2, 6]]],
  Z: [[[0, 0], [4.2, 0], [0, 6], [4.2, 6]]],
  Ä: [...A, dot(0.9, -2.1), dot(3.5, -2.1)],
  Ö: [...O, dot(0.9, -2.1), dot(3.5, -2.1)],
  Ü: [U, dot(0.9, -2.1), dot(3.5, -2.1)],
  '0': [arc(2.2, 3, 2.1, 3, 0, 360, 28)],
  '1': [[[0.2, 1.4], [2, 0], [2, 6]]],
  '2': [join(arc(2.2, 1.9, 2.1, 1.9, -190, 40, 18), [[0, 6], [4.4, 6]])],
  '3': [join(arc(2.1, 1.5, 1.9, 1.5, -150, 90, 16), arc(2.1, 4.5, 2.2, 1.5, -90, 150, 18))],
  '4': [[[3.4, 6], [3.4, 0], [0, 4.2], [4.6, 4.2]]],
  '5': [join([[3.8, 0], [0.4, 0], [0.2, 2.7]], arc(2.1, 4, 2.2, 2, -125, 150, 20))],
  '6': SIX,
  '7': [[[0, 0], [4.3, 0], [1.4, 6]]],
  '8': [arc(2.1, 1.5, 1.7, 1.5, 0, 360, 22), arc(2.1, 4.5, 2.2, 1.5, 0, 360, 22)],
  '9': flip180(SIX, 2.2, 3),
  '.': [dot(0, 6)],
  '!': [[[0, 0], [0, 3.6]], dot(0, 6)],
  '?': [join(arc(2.1, 1.9, 1.9, 1.9, -190, 40, 16), [[2.2, 4]]), dot(2.2, 6)],
  '-': [[[0, 3], [2.6, 3]]],
  ':': [dot(0, 1.8), dot(0, 4.8)],
};

export const SUPPORTED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789.!?-'.split('');

function distSeg(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - a[0]) * dx + (py - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

const glyphCache = new Map<string, Shape>();

/** Umriss eines Buchstabens, links bei x=0 beginnend (Glyphen-Einheiten, y nach unten). */
export function glyphShape(ch: string): Shape {
  const cached = glyphCache.get(ch);
  if (cached) return cached;
  const strokes = GLYPHS[ch];
  if (!strokes) return [];
  const segs: [Pt, Pt][] = [];
  for (const s of strokes) for (let i = 0; i + 1 < s.length; i++) segs.push([s[i], s[i + 1]]);
  const pts = strokes.flat();
  const pad = STROKE_R + 0.3;
  const box = {
    minX: Math.min(...pts.map((p) => p[0])) - pad,
    maxX: Math.max(...pts.map((p) => p[0])) + pad,
    minY: Math.min(...pts.map((p) => p[1])) - pad,
    maxY: Math.max(...pts.map((p) => p[1])) + pad,
  };
  const field = (x: number, y: number) => {
    let d = Infinity;
    for (const [a, b] of segs) d = Math.min(d, distSeg(x, y, a, b));
    return d - STROKE_R;
  };
  const rings = contour(field, box, 0.07).map((r): Ring => {
    const closed = [...r, r[0]];
    const s = simplify(closed, 0.012);
    s.pop();
    return s;
  });
  const b = bbox(rings);
  const shifted = normalizeShape(rings.map((r) => r.map(([x, y]) => [x - b.minX, y] as Pt)));
  glyphCache.set(ch, shifted);
  return shifted;
}

export function normalizeText(text: string): string {
  return text.toUpperCase().replace(/ß/g, 'SS');
}

/** Ganzer Text als Form (eine Zeile). Höhe der Großbuchstaben = GLYPH_HEIGHT Einheiten. */
export function textShape(text: string): Shape {
  const out: Shape = [];
  let x = 0;
  const gap = 0.55;
  for (const ch of normalizeText(text)) {
    if (ch === ' ') {
      x += 3;
      continue;
    }
    const g = glyphShape(ch);
    if (g.length === 0) continue;
    const w = Math.max(...g.flat().map((p) => p[0]));
    for (const r of g) out.push(r.map(([px, py]) => [px + x, py] as Pt));
    x += w + gap;
  }
  return out;
}
