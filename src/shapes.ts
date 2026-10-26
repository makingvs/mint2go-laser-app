// Vorgefertigte Formen. Die Größe wird beim Einfügen angepasst; Löcher (Ring, Rahmen) ergeben sich per Even-Odd.
import { unionShapes, type Pt, type Ring, type Shape } from './geometry';

export type ShapeId =
  | 'circle' | 'oval' | 'square' | 'rectangle' | 'roundrect' | 'triangle' | 'pentagon' | 'hexagon' | 'octagon'
  | 'diamond' | 'trapezoid' | 'parallelogram' | 'semicircle' | 'quarter'
  | 'star' | 'star6' | 'burst' | 'heart' | 'flower'
  | 'arrow' | 'cross' | 'bolt' | 'moon' | 'cloud' | 'drop' | 'speech' | 'house' | 'ring' | 'frame';

/** Gruppen der Auswahl (Reihenfolge = Anzeige). */
export const SHAPE_GROUPS: { id: string; ids: ShapeId[] }[] = [
  { id: 'grund', ids: ['circle', 'oval', 'square', 'rectangle', 'roundrect', 'triangle', 'pentagon', 'hexagon', 'octagon', 'diamond', 'trapezoid', 'parallelogram', 'semicircle', 'quarter'] },
  { id: 'sterne', ids: ['star', 'star6', 'burst', 'heart', 'flower'] },
  { id: 'zeichen', ids: ['arrow', 'cross', 'bolt', 'moon', 'cloud', 'drop', 'speech', 'house', 'ring', 'frame'] },
];

export const SHAPE_IDS: ShapeId[] = SHAPE_GROUPS.flatMap((g) => g.ids);

/** Namen für Bedienhilfen (Vorlesefunktion) */
export const SHAPE_LABELS: Record<ShapeId, string> = {
  circle: 'Kreis', oval: 'Oval', square: 'Quadrat', rectangle: 'Rechteck', roundrect: 'Abgerundetes Quadrat', triangle: 'Dreieck',
  pentagon: 'Fünfeck', hexagon: 'Sechseck', octagon: 'Achteck', diamond: 'Raute', trapezoid: 'Trapez', parallelogram: 'Parallelogramm',
  semicircle: 'Halbkreis', quarter: 'Viertelkreis', star: 'Stern', star6: 'Sechsstern', burst: 'Zackenstern', heart: 'Herz', flower: 'Blume',
  arrow: 'Pfeil', cross: 'Kreuz', bolt: 'Blitz', moon: 'Mond', cloud: 'Wolke', drop: 'Tropfen', speech: 'Sprechblase', house: 'Haus', ring: 'Ring', frame: 'Rahmen',
};

export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 96, rotDeg = 0): Ring {
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

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Punkte auf einem Kreisbogen (Winkel in Grad, y nach unten). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Ring {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
}

const regular = (n: number, startDeg = -90): Ring => Array.from({ length: n }, (_, i) => [Math.cos(rad(startDeg + (360 * i) / n)), Math.sin(rad(startDeg + (360 * i) / n))] as Pt);

function starPoints(n: number, inner: number): Ring {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 1 : inner;
    const a = rad(-90 + (180 * i) / n);
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });
}

function roundedRect(hw: number, hh: number, r: number): Ring {
  return [
    ...arc(hw - r, -hh + r, r, -90, 0, 8),
    ...arc(hw - r, hh - r, r, 0, 90, 8),
    ...arc(-hw + r, hh - r, r, 90, 180, 8),
    ...arc(-hw + r, -hh + r, r, 180, 270, 8),
  ];
}

function moon(): Ring {
  const d = 0.55;
  const r2 = 0.8;
  const x = (d * d + 1 - r2 * r2) / (2 * d);
  const y = Math.sqrt(1 - x * x);
  const th = Math.atan2(y, x) * (180 / Math.PI); // Schnittpunkt auf dem großen Kreis
  const psi = Math.atan2(y, x - d) * (180 / Math.PI); // Schnittpunkt auf dem inneren Kreis
  return [...arc(0, 0, 1, th, 360 - th, 40), ...arc(d, 0, r2, 360 - psi, psi, 40)];
}

function drop(): Ring {
  const c = 0.35;
  const r = 0.65;
  const beta = (Math.acos(r / (c + 1)) * 180) / Math.PI;
  return [[0, -1], ...arc(0, c, r, -90 + beta, 270 - beta, 40)];
}

const cache = new Map<ShapeId, Shape>();

/** Grundformen in natürlichen Einheiten (Kasten ca. -1..1). */
export function baseShape(id: ShapeId): Shape {
  const hit = cache.get(id);
  if (hit) return hit;
  const s = build(id);
  cache.set(id, s);
  return s;
}

function build(id: ShapeId): Shape {
  switch (id) {
    case 'circle': return [ellipse(0, 0, 1, 1, 128)];
    case 'oval': return [ellipse(0, 0, 1, 0.62, 128)];
    case 'square': return [[[-1, -1], [1, -1], [1, 1], [-1, 1]]];
    case 'rectangle': return [[[-1, -0.55], [1, -0.55], [1, 0.55], [-1, 0.55]]];
    case 'roundrect': return [roundedRect(1, 1, 0.38)];
    case 'triangle': return [[[0, -1], [1.1, 0.9], [-1.1, 0.9]]];
    case 'pentagon': return [regular(5)];
    case 'hexagon': return [regular(6, 30)];
    case 'octagon': return [regular(8, 22.5)];
    case 'diamond': return [[[0, -1], [0.75, 0], [0, 1], [-0.75, 0]]];
    case 'trapezoid': return [[[-0.55, -0.6], [0.55, -0.6], [1, 0.6], [-1, 0.6]]];
    case 'parallelogram': return [[[-0.55, -0.6], [1, -0.6], [0.55, 0.6], [-1, 0.6]]];
    case 'semicircle': return [arc(0, 0, 1, 180, 360, 64)];
    case 'quarter': return [[[0, 0], ...arc(0, 0, 1, -90, 0, 40)]];
    case 'star': return [starPoints(5, 0.42)];
    case 'star6': return [starPoints(6, 0.55)];
    case 'burst': return [starPoints(14, 0.78)];
    case 'heart': {
      const r: Ring = [];
      const n = 120;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        r.push([x, y]);
      }
      return [r];
    }
    case 'flower': {
      const petals = Array.from({ length: 6 }, (_, i) => [ellipse(Math.cos(rad(-90 + i * 60)) * 0.58, Math.sin(rad(-90 + i * 60)) * 0.58, 0.4, 0.4, 40)]);
      return unionShapes([...petals, [ellipse(0, 0, 0.45, 0.45, 40)]]);
    }
    case 'arrow': return [[[-1, -0.35], [0.15, -0.35], [0.15, -0.8], [1, 0], [0.15, 0.8], [0.15, 0.35], [-1, 0.35]]];
    case 'cross': return [[[-0.34, -1], [0.34, -1], [0.34, -0.34], [1, -0.34], [1, 0.34], [0.34, 0.34], [0.34, 1], [-0.34, 1], [-0.34, 0.34], [-1, 0.34], [-1, -0.34], [-0.34, -0.34]]];
    case 'bolt': return [[[0.15, -1], [-0.6, 0.12], [-0.12, 0.12], [-0.35, 1], [0.6, -0.2], [0.1, -0.2], [0.55, -1]]];
    case 'moon': return [moon()];
    case 'cloud':
      return unionShapes([
        [ellipse(-0.52, 0.12, 0.42, 0.42, 40)],
        [ellipse(0.02, -0.18, 0.58, 0.58, 40)],
        [ellipse(0.56, 0.12, 0.42, 0.42, 40)],
        [[[-0.52, 0.12], [0.56, 0.12], [0.56, 0.54], [-0.52, 0.54]]],
      ]);
    case 'drop': return [drop()];
    case 'speech':
      return unionShapes([[roundedRect(1, 0.62, 0.3)], [[[-0.55, 0.45], [-0.75, 1.05], [0.05, 0.45]]]]);
    case 'house': return [[[-1, -0.05], [0, -1], [1, -0.05], [0.78, -0.05], [0.78, 1], [-0.78, 1], [-0.78, -0.05]]];
    case 'ring': return [ellipse(0, 0, 1, 1, 128), ellipse(0, 0, 0.5, 0.5, 96)];
    case 'frame': return [[[-1, -1], [1, -1], [1, 1], [-1, 1]], [[-0.55, -0.55], [0.55, -0.55], [0.55, 0.55], [-0.55, 0.55]]];
  }
}
