import type { Pt, Ring, Shape } from './geometry';

export type ShapeId = 'circle' | 'square' | 'triangle' | 'star' | 'heart';
export const SHAPE_IDS: ShapeId[] = ['circle', 'square', 'triangle', 'star', 'heart'];

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 96, rotDeg = 0): Ring {
  const a = (rotDeg * Math.PI) / 180;
  const out: Ring = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    out.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return out;
}

export { ellipse };

/** Grundformen in natürlichen Einheiten; die Größe wird beim Einfügen angepasst. */
export function baseShape(id: ShapeId): Shape {
  switch (id) {
    case 'circle':
      return [ellipse(0, 0, 1, 1, 128)];
    case 'square':
      return [[[-1, -1], [1, -1], [1, 1], [-1, 1]]];
    case 'triangle':
      return [[[0, -1], [1.1, 0.9], [-1.1, 0.9]]];
    case 'star': {
      const r: Ring = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? 1 : 0.42;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        r.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      return [r];
    }
    case 'heart': {
      const r: Ring = [];
      const n = 120;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        r.push([x, y] as Pt);
      }
      return [r];
    }
  }
}
