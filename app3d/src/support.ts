// Körper auf Körper legen (reine Rechnung): worauf ruht ein Körper, wenn er an eine Stelle geschoben wird?
// Die Auflagepunkte des Körpers (seine Bodenfläche) werden senkrecht auf die anderen Körper projiziert;
// er ruht auf der höchsten Fläche darunter (Bett = 0). So landet z. B. ein Text oben auf einem Quader.
import { meshOf, worldVertices, type Part } from './model3d';

const EPS = 1e-9;

interface World {
  v: number[];
  idx: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
}

// Die anderen Körper ändern sich beim Ziehen nicht: ihre Eckpunkte nur einmal berechnen
const cache = new WeakMap<Part, World>();

function world(p: Part): World {
  let w = cache.get(p);
  if (!w) {
    const v = worldVertices(p);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    for (let i = 0; i < v.length; i += 3) {
      minX = Math.min(minX, v[i]);
      maxX = Math.max(maxX, v[i]);
      minY = Math.min(minY, v[i + 1]);
      maxY = Math.max(maxY, v[i + 1]);
      minZ = Math.min(minZ, v[i + 2]);
    }
    w = { v, idx: meshOf(p).idx, minX, maxX, minY, maxY, minZ };
    cache.set(p, w);
  }
  return w;
}

/** Höhe der obersten Fläche des Körpers an der Stelle (x, y); -Infinity, wenn dort nichts ist. */
function surfaceZ(w: World, x: number, y: number): number {
  if (x < w.minX - EPS || x > w.maxX + EPS || y < w.minY - EPS || y > w.maxY + EPS) return -Infinity;
  const { v, idx } = w;
  let best = -Infinity;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const ax = v[a];
    const ay = v[a + 1];
    const bx = v[b];
    const by = v[b + 1];
    const cx = v[c];
    const cy = v[c + 1];
    if (x < Math.min(ax, bx, cx) - EPS || x > Math.max(ax, bx, cx) + EPS || y < Math.min(ay, by, cy) - EPS || y > Math.max(ay, by, cy) + EPS) continue;
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-12) continue; // senkrechte Wand
    const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
    const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 >= -1e-7 && l2 >= -1e-7 && l3 >= -1e-7) {
      const z = l1 * v[a + 2] + l2 * v[b + 2] + l3 * v[c + 2];
      if (z > best) best = z;
    }
  }
  return best;
}

const MAX_EDGE_SAMPLES = 24;
const GRID = 6;

/** Auflagepunkte (x, y) eines Körpers: Eckpunkte seiner Bodenfläche und ein Raster darin. */
export function contactSamples(p: Part): [number, number][] {
  const m = meshOf(p);
  const a = (p.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const toWorld = (i: number): [number, number] => {
    const lx = m.pos[i * 3] * p.w;
    const ly = m.pos[i * 3 + 1] * p.d;
    return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
  };
  const bottom = new Set<number>();
  for (let i = 0; i < m.pos.length / 3; i++) if (m.pos[i * 3 + 2] <= 1e-6) bottom.add(i);
  const verts = [...bottom];
  const stride = Math.max(1, Math.ceil(verts.length / MAX_EDGE_SAMPLES));
  const out: [number, number][] = verts.filter((_, i) => i % stride === 0).map(toWorld);
  // Bodendreiecke -> Raster im Inneren (damit z. B. eine große Platte über einem kleinen Würfel auf ihm landet)
  const tris: [[number, number], [number, number], [number, number]][] = [];
  for (let t = 0; t < m.idx.length; t += 3) {
    if (bottom.has(m.idx[t]) && bottom.has(m.idx[t + 1]) && bottom.has(m.idx[t + 2])) tris.push([toWorld(m.idx[t]), toWorld(m.idx[t + 1]), toWorld(m.idx[t + 2])]);
  }
  if (tris.length) {
    const xs = tris.flatMap((t) => t.map((q) => q[0]));
    const ys = tris.flatMap((t) => t.map((q) => q[1]));
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let i = 0; i <= GRID; i++)
      for (let j = 0; j <= GRID; j++) {
        const x = x0 + ((x1 - x0) * i) / GRID;
        const y = y0 + ((y1 - y0) * j) / GRID;
        if (tris.some(([A, B, C]) => inTri(x, y, A, B, C))) out.push([x, y]);
      }
  }
  return out;
}

function inTri(x: number, y: number, A: [number, number], B: [number, number], C: [number, number]): boolean {
  const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  if (Math.abs(d) < 1e-12) return false;
  const l1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d;
  const l2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d;
  return l1 >= -1e-7 && l2 >= -1e-7 && 1 - l1 - l2 >= -1e-7;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Höhe des Bodens, auf dem der Körper ruht (x, y, Größe und Drehung wie in `p`):
 * die höchste Fläche der anderen vollen Körper unter seinen Auflagepunkten, sonst das Bett (0).
 * Körper, die selbst auf dem Körper liegen (ihr Boden ist nicht tiefer als dessen Oberseite), zählen nicht;
 * dafür zählt `ref` (der Körper vor dem Ziehen), damit das Ergebnis beim Ziehen nicht von Schritt zu Schritt springt.
 */
export function supportHeight(p: Part, others: Part[], ref: Part = p): number {
  const top = ref.z + ref.h;
  const cand = others.filter((o) => o.id !== p.id && !o.hole).map(world).filter((w) => w.minZ < top - 0.05);
  if (!cand.length) return 0;
  const samples = contactSamples(p);
  let z = 0;
  for (const w of cand) {
    for (const [x, y] of samples) {
      const h = surfaceZ(w, x, y);
      if (h > z) z = h;
    }
  }
  return round2(z);
}

/** Der Körper fällt auf das, was unter ihm liegt. */
export const restOn = (p: Part, others: Part[], ref: Part = p): Part => ({ ...p, z: supportHeight(p, others, ref) });

/** Mitte auf Mitte: rastet x und y an der Mitte eines anderen Körpers ein, wenn sie näher als `tol` mm liegen. */
export function snapToCenters(p: Part, others: Part[], tol = 2.5): Part {
  let { x, y } = p;
  let bx = tol;
  let by = tol;
  for (const o of others) {
    if (o.id === p.id || o.hole) continue;
    if (Math.abs(p.x - o.x) < bx) {
      bx = Math.abs(p.x - o.x);
      x = o.x;
    }
    if (Math.abs(p.y - o.y) < by) {
      by = Math.abs(p.y - o.y);
      y = o.y;
    }
  }
  return x === p.x && y === p.y ? p : { ...p, x, y };
}
