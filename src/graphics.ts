// Grafik-Bibliothek: fertige, laserfähige Motive. Alle Motive sind selbst gezeichnet
// (Zusammensetzung aus Grundformen), daher gibt es keine Lizenzfragen.
// Koordinaten: Rahmen 0..100, y nach unten. "body" wird vereinigt, "holes" sind Löcher
// (z. B. Augen, Fenster) und müssen vollständig innerhalb des Körpers liegen.
import { unionShapes, type Pt, type Ring, type Shape } from './geometry';
import { ellipse } from './shapes';

export type Theme = 'tiere' | 'fahrzeuge' | 'natur' | 'dinge';
export const THEMES: { id: Theme; icon: string }[] = [
  { id: 'tiere', icon: '🐱' },
  { id: 'fahrzeuge', icon: '🚗' },
  { id: 'natur', icon: '🌳' },
  { id: 'dinge', icon: '🏠' },
];

interface Def {
  id: string;
  theme: Theme;
  body: Ring[];
  holes?: Ring[];
}

const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0): Ring => ellipse(cx, cy, rx, ry, 48, rot);
const rect = (x: number, y: number, w: number, h: number): Ring => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const poly = (...p: Pt[]): Ring => p;

function petals(cx: number, cy: number, dist: number, r: number, n: number, start = -90): Ring[] {
  return Array.from({ length: n }, (_, k) => {
    const a = ((start + (360 / n) * k) * Math.PI) / 180;
    return ell(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r, r);
  });
}

function rays(cx: number, cy: number, r0: number, r1: number, half: number, n: number): Ring[] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const px = -uy;
    const py = ux;
    return poly(
      [cx + ux * r0 + px * half, cy + uy * r0 + py * half],
      [cx + ux * r1, cy + uy * r1],
      [cx + ux * r0 - px * half, cy + uy * r0 - py * half],
    );
  });
}

function halfEllipse(cx: number, cy: number, rx: number, ry: number): Ring {
  const out: Ring = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI + (i / 40) * Math.PI;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

const DEFS: Def[] = [
  {
    id: 'fisch',
    theme: 'tiere',
    body: [ell(44, 50, 36, 23), poly([68, 50], [97, 24], [88, 50], [97, 76]), poly([30, 30], [48, 12], [60, 32])],
    holes: [ell(26, 45, 4.5, 4.5)],
  },
  {
    id: 'katze',
    theme: 'tiere',
    body: [ell(50, 58, 35, 31), poly([18, 44], [20, 6], [46, 28]), poly([82, 44], [80, 6], [54, 28])],
    holes: [ell(37, 54, 5, 7), ell(63, 54, 5, 7), poly([46, 66], [54, 66], [50, 71])],
  },
  {
    id: 'hund',
    theme: 'tiere',
    body: [ell(50, 52, 24, 32), ell(20, 54, 11, 26, 12), ell(80, 54, 11, 26, -12), ell(50, 76, 16, 14)],
    holes: [ell(41, 46, 4.5, 4.5), ell(59, 46, 4.5, 4.5), ell(50, 70, 7, 4.5)],
  },
  {
    id: 'schmetterling',
    theme: 'tiere',
    body: [ell(29, 34, 23, 25, -22), ell(71, 34, 23, 25, 22), ell(33, 68, 16, 18, 16), ell(67, 68, 16, 18, -16), ell(50, 50, 6, 31)],
    holes: [ell(28, 32, 8, 9, -22), ell(72, 32, 8, 9, 22), ell(33, 70, 5, 6), ell(67, 70, 5, 6)],
  },
  {
    id: 'auto',
    theme: 'fahrzeuge',
    body: [rect(6, 52, 88, 26), poly([22, 52], [34, 28], [66, 28], [80, 52]), ell(28, 78, 13, 13), ell(72, 78, 13, 13)],
    holes: [poly([29, 48], [37, 33], [47, 33], [47, 48]), poly([53, 48], [53, 33], [63, 33], [71, 48]), ell(28, 78, 4.5, 4.5), ell(72, 78, 4.5, 4.5)],
  },
  {
    id: 'schiff',
    theme: 'fahrzeuge',
    body: [poly([8, 60], [92, 60], [76, 86], [24, 86]), poly([47, 8], [47, 64], [16, 64]), poly([54, 22], [54, 64], [82, 64])],
    holes: [ell(36, 72, 3.8, 3.8), ell(50, 72, 3.8, 3.8), ell(64, 72, 3.8, 3.8)],
  },
  {
    id: 'rakete',
    theme: 'fahrzeuge',
    body: [ell(50, 44, 16, 36), poly([36, 58], [16, 82], [38, 76]), poly([64, 58], [84, 82], [62, 76]), poly([40, 76], [50, 98], [60, 76])],
    holes: [ell(50, 34, 7, 7)],
  },
  {
    id: 'baum',
    theme: 'natur',
    body: [ell(50, 34, 30, 27), ell(30, 52, 21, 17), ell(70, 52, 21, 17), rect(43, 56, 14, 40)],
  },
  {
    id: 'blume',
    theme: 'natur',
    body: [...petals(50, 36, 20, 14, 5), ell(50, 36, 14, 14), rect(47, 52, 6, 44), ell(68, 78, 16, 7, -30), ell(32, 68, 14, 6, 30)],
    holes: [ell(50, 36, 6, 6)],
  },
  {
    id: 'sonne',
    theme: 'natur',
    body: [ell(50, 50, 23, 23), ...rays(50, 50, 29, 47, 5, 8)],
    holes: [ell(42, 45, 3.2, 4.5), ell(58, 45, 3.2, 4.5)],
  },
  {
    id: 'pilz',
    theme: 'natur',
    body: [halfEllipse(50, 52, 42, 40), rect(34, 50, 32, 42), ell(50, 92, 20, 5)],
    holes: [ell(30, 38, 6, 5), ell(52, 26, 7, 6), ell(72, 40, 5.5, 4.5)],
  },
  {
    id: 'wolke',
    theme: 'dinge',
    body: [ell(32, 56, 22, 20), ell(55, 42, 24, 24), ell(76, 58, 20, 18), rect(28, 58, 50, 18), ell(28, 66, 14, 12), ell(76, 66, 15, 12)],
  },
  {
    id: 'haus',
    theme: 'dinge',
    body: [rect(15, 46, 70, 48), poly([6, 50], [50, 10], [94, 50]), rect(68, 14, 10, 26)],
    holes: [rect(42, 64, 16, 26), rect(22, 58, 13, 13), rect(65, 58, 13, 13)],
  },
];

const cache = new Map<string, Shape>();

export interface Graphic {
  id: string;
  theme: Theme;
}

export const GRAPHICS: Graphic[] = DEFS.map((d) => ({ id: d.id, theme: d.theme }));

/** Umriss des Motivs im Rahmen 0..100. */
export function graphicShape(id: string): Shape {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = DEFS.find((d) => d.id === id);
  if (!def) return [];
  const merged = unionShapes(def.body.map((r) => [r]));
  const shape = [...merged, ...(def.holes ?? [])];
  cache.set(id, shape);
  return shape;
}

export function graphicParts(id: string): Def | undefined {
  return DEFS.find((d) => d.id === id);
}
