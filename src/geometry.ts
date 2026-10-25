// Geometrie-Grundlagen. Alle Maße in Millimetern, y zeigt nach unten.
// Eine "Form" (Shape) ist eine Liste von Ringen; Löcher ergeben sich nach der
// Even-Odd-Regel (ein Ring innerhalb eines anderen ist ein Loch).

export type Pt = [number, number];
export type Ring = Pt[];
export type Shape = Ring[];

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const EPS = 1e-9;
const SNAP = 1e-6;

export function signedArea(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function perimeter(r: Ring, closed = true): number {
  let p = 0;
  const n = closed ? r.length : r.length - 1;
  for (let i = 0; i < n; i++) p += dist(r[i], r[(i + 1) % r.length]);
  return p;
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function bbox(rings: Shape): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rings) {
    for (const [x, y] of r) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function boxesOverlap(a: BBox, b: BBox, tol = 1e-7): boolean {
  return a.minX <= b.maxX + tol && b.minX <= a.maxX + tol && a.minY <= b.maxY + tol && b.minY <= a.maxY + tol;
}

/** Even-Odd-Test über alle Ringe. */
export function pointInShape(p: Pt, shape: Shape): boolean {
  let inside = false;
  for (const r of shape) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Abstand eines Punktes zu einer Strecke. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function distToPolyline(p: Pt, pts: Pt[], closed = false): number {
  let best = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) best = Math.min(best, distToSegment(p, pts[i], pts[(i + 1) % pts.length]));
  return best;
}

export interface Transform {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number; // Grad
}

export function transformPoint(p: Pt, t: Transform): Pt {
  const a = (t.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const px = p[0] * t.w;
  const py = p[1] * t.h;
  return [t.x + px * c - py * s, t.y + px * s + py * c];
}

export function transformShape(shape: Shape, t: Transform): Shape {
  return shape.map((r) => r.map((p) => transformPoint(p, t)));
}

function cleanRing(r: Ring): Ring {
  const out: Ring = [];
  for (const p of r) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > SNAP) out.push([p[0], p[1]]);
  }
  while (out.length > 1 && dist(out[0], out[out.length - 1]) <= SNAP) out.pop();
  return out;
}

/**
 * Bereinigt eine Form und richtet die Ringe nach ihrer Schachtelungstiefe aus:
 * gerade Tiefe = positiver Umlaufsinn (Außenring), ungerade = negativ (Loch).
 * Danach liegt das Innere immer links der Kante.
 */
export function normalizeShape(shape: Shape): Shape {
  const rings = shape.map(cleanRing).filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 1e-9);
  return rings.map((r, i) => {
    let depth = 0;
    for (let j = 0; j < rings.length; j++) {
      if (j !== i && pointInRing(r[0], rings[j]) && Math.abs(signedArea(rings[j])) > Math.abs(signedArea(r))) depth++;
    }
    const wantPositive = depth % 2 === 0;
    const isPositive = signedArea(r) > 0;
    return wantPositive === isPositive ? r : [...r].reverse();
  });
}

function pointInRing(p: Pt, r: Ring): boolean {
  return pointInShape(p, [r]);
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

interface Split {
  t: number;
  p: Pt;
}

/** Vereinigt mehrere Formen zu einer Form (äußere Umrisse, Löcher bleiben erhalten). */
export function unionShapes(input: Shape[]): Shape {
  const shapes = input.map(normalizeShape).filter((s) => s.length > 0);
  if (shapes.length === 0) return [];
  if (shapes.length === 1) return shapes[0];

  const boxes = shapes.map(bbox);
  const splits: Split[][][][] = shapes.map((s) => s.map((r) => r.map(() => [] as Split[])));

  // Schnittpunkte aller Kanten untereinander bestimmen und beiden Kanten gemeinsam zuweisen.
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      if (!boxesOverlap(boxes[i], boxes[j])) continue;
      for (let ri = 0; ri < shapes[i].length; ri++) {
        for (let rj = 0; rj < shapes[j].length; rj++) {
          const A = shapes[i][ri];
          const B = shapes[j][rj];
          for (let ei = 0; ei < A.length; ei++) {
            const a1 = A[ei];
            const a2 = A[(ei + 1) % A.length];
            for (let ej = 0; ej < B.length; ej++) {
              intersectEdges(a1, a2, B[ej], B[(ej + 1) % B.length], splits[i][ri][ei], splits[j][rj][ej]);
            }
          }
        }
      }
    }
  }

  // Teilstrecken bilden und behalten, wenn sie am Rand der Vereinigung liegen.
  const kept: { a: Pt; b: Pt }[] = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let ri = 0; ri < shapes[i].length; ri++) {
      const R = shapes[i][ri];
      for (let e = 0; e < R.length; e++) {
        const p1 = R[e];
        const p2 = R[(e + 1) % R.length];
        const pts: Pt[] = [p1];
        const sp = [...splits[i][ri][e]].sort((x, y) => x.t - y.t);
        for (const s of sp) {
          if (dist(pts[pts.length - 1], s.p) > SNAP) pts.push(s.p);
        }
        if (dist(pts[pts.length - 1], p2) > SNAP) pts.push(p2);
        else pts[pts.length - 1] = p2;
        for (let k = 0; k + 1 < pts.length; k++) {
          const a = pts[k];
          const b = pts[k + 1];
          if (dist(a, b) <= SNAP) continue;
          if (keepSegment(a, b, i, shapes, boxes)) kept.push({ a, b });
        }
      }
    }
  }
  return normalizeShape(chain(kept));
}

function intersectEdges(a1: Pt, a2: Pt, b1: Pt, b2: Pt, sa: Split[], sb: Split[]): void {
  const dax = a2[0] - a1[0];
  const day = a2[1] - a1[1];
  const dbx = b2[0] - b1[0];
  const dby = b2[1] - b1[1];
  const d = cross(dax, day, dbx, dby);
  const la = Math.hypot(dax, day);
  const lb = Math.hypot(dbx, dby);
  if (la < EPS || lb < EPS) return;
  const inner = (t: number) => t > 1e-9 && t < 1 - 1e-9;
  if (Math.abs(d) < 1e-10 * la * lb) {
    // parallel: bei Deckungsgleichheit die Endpunkte der anderen Kante als Teilpunkte eintragen
    const off = Math.abs(cross(b1[0] - a1[0], b1[1] - a1[1], dax, day)) / la;
    if (off > 1e-6) return;
    for (const q of [b1, b2]) {
      const t = ((q[0] - a1[0]) * dax + (q[1] - a1[1]) * day) / (la * la);
      if (inner(t)) sa.push({ t, p: q });
    }
    for (const q of [a1, a2]) {
      const t = ((q[0] - b1[0]) * dbx + (q[1] - b1[1]) * dby) / (lb * lb);
      if (inner(t)) sb.push({ t, p: q });
    }
    return;
  }
  const t = cross(b1[0] - a1[0], b1[1] - a1[1], dbx, dby) / d;
  const u = cross(b1[0] - a1[0], b1[1] - a1[1], dax, day) / d;
  const tol = 1e-9;
  if (t < -tol || t > 1 + tol || u < -tol || u > 1 + tol) return;
  let p: Pt = [a1[0] + t * dax, a1[1] + t * day];
  // Auf Eckpunkte einrasten, damit beide Kanten exakt denselben Punkt verwenden.
  if (t <= 1e-9) p = a1;
  else if (t >= 1 - 1e-9) p = a2;
  else if (u <= 1e-9) p = b1;
  else if (u >= 1 - 1e-9) p = b2;
  if (inner(t)) sa.push({ t, p });
  if (inner(u)) sb.push({ t: u, p });
}

function keepSegment(a: Pt, b: Pt, self: number, shapes: Shape[], boxes: BBox[]): boolean {
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  for (let j = 0; j < shapes.length; j++) {
    if (j === self) continue;
    const bb = boxes[j];
    if (m[0] < bb.minX - 1e-5 || m[0] > bb.maxX + 1e-5 || m[1] < bb.minY - 1e-5 || m[1] > bb.maxY + 1e-5) continue;
    // liegt die Strecke auf dem Rand der anderen Form?
    let onEdge = false;
    for (const r of shapes[j]) {
      for (let k = 0; k < r.length; k++) {
        const c = r[k];
        const d = r[(k + 1) % r.length];
        if (distToSegment(m, c, d) < 1e-5) {
          onEdge = true;
          const same = dx * (d[0] - c[0]) + dy * (d[1] - c[1]) > 0;
          if (!same) return false; // gemeinsame Kante, Nachbarn: innen
          if (self > j) return false; // doppelte Kante: nur einmal behalten
        }
      }
    }
    if (onEdge) continue;
    if (pointInShape(m, shapes[j])) return false;
  }
  return true;
}

function keyOf(p: Pt): string {
  return `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
}

function chain(segs: { a: Pt; b: Pt }[]): Shape {
  const byStart = new Map<string, number[]>();
  segs.forEach((s, i) => {
    const k = keyOf(s.a);
    const list = byStart.get(k);
    if (list) list.push(i);
    else byStart.set(k, [i]);
  });
  const used = new Array(segs.length).fill(false);
  const rings: Shape = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const ring: Ring = [];
    let cur = i;
    const startKey = keyOf(segs[i].a);
    for (let guard = 0; guard <= segs.length; guard++) {
      used[cur] = true;
      ring.push(segs[cur].a);
      const endKey = keyOf(segs[cur].b);
      if (endKey === startKey) break;
      const next = (byStart.get(endKey) ?? []).find((k) => !used[k]);
      if (next === undefined) break;
      cur = next;
    }
    if (ring.length >= 3) rings.push(dropCollinear(ring));
  }
  return rings;
}

function dropCollinear(r: Ring): Ring {
  const out: Ring = [];
  for (let i = 0; i < r.length; i++) {
    const p = r[(i + r.length - 1) % r.length];
    const c = r[i];
    const n = r[(i + 1) % r.length];
    const cr = Math.abs(cross(c[0] - p[0], c[1] - p[1], n[0] - c[0], n[1] - c[1]));
    const dot = (c[0] - p[0]) * (n[0] - c[0]) + (c[1] - p[1]) * (n[1] - c[1]);
    if (cr < 1e-9 && dot > 0) continue;
    out.push(c);
  }
  return out.length >= 3 ? out : r;
}

/** Fläche der Form (Even-Odd, Ringe nach Normalisierung). */
export function shapeArea(shape: Shape): number {
  const n = normalizeShape(shape);
  return n.reduce((acc, r) => acc + signedArea(r), 0);
}

export function shapePerimeter(shape: Shape): number {
  return shape.reduce((acc, r) => acc + perimeter(r), 0);
}

/** Grobes Maß für die dünnste Stelle: 4·Fläche/Umfang (Kreis: Durchmesser, Streifen: ca. 2× Breite). */
export function featureSize(shape: Shape): number {
  const p = shapePerimeter(shape);
  return p === 0 ? 0 : (4 * Math.abs(shapeArea(shape))) / p;
}

/** Douglas-Peucker-Vereinfachung einer offenen Linie. */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distToSegment(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > eps) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Punkte in gleichmäßigem Abstand entlang der Linie. */
export function resample(pts: Pt[], spacing: number, closed = false): Pt[] {
  const src = closed ? [...pts, pts[0]] : pts;
  if (src.length < 2) return pts.slice();
  const out: Pt[] = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1];
    const b = src[i];
    const len = dist(a, b);
    let d = spacing - carry;
    while (d <= len) {
      const t = d / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
}

/** Glättet eine Linie durch gleitenden Mittelwert (Enden bleiben fest, bei geschlossenen Linien kreisförmig). */
export function smooth(pts: Pt[], passes: number, closed: boolean): Pt[] {
  let cur = pts.map((p) => [p[0], p[1]] as Pt);
  const n = cur.length;
  if (n < 3) return cur;
  for (let k = 0; k < passes; k++) {
    const next = cur.map((p) => [p[0], p[1]] as Pt);
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;
      const a = cur[(i + n - 1) % n];
      const c = cur[i];
      const b = cur[(i + 1) % n];
      next[i] = [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4];
    }
    cur = next;
  }
  return cur;
}

/**
 * Isolinie f = 0 eines Abstandsfeldes (Marching Squares). Innen ist f < 0.
 * Liefert geschlossene Ringe; die Orientierung wird später normalisiert.
 */
export function contour(f: (x: number, y: number) => number, box: BBox, step: number): Ring[] {
  const nx = Math.ceil((box.maxX - box.minX) / step) + 1;
  const ny = Math.ceil((box.maxY - box.minY) / step) + 1;
  const val = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[j * nx + i] = f(box.minX + i * step, box.minY + j * step);
  const V = (i: number, j: number) => val[j * nx + i];
  const pointOnEdge = new Map<string, Pt>();
  const edgePoint = (id: string, i0: number, j0: number, i1: number, j1: number): string => {
    if (!pointOnEdge.has(id)) {
      const v0 = V(i0, j0);
      const v1 = V(i1, j1);
      const t = v0 / (v0 - v1);
      pointOnEdge.set(id, [box.minX + (i0 + (i1 - i0) * t) * step, box.minY + (j0 + (j1 - j0) * t) * step]);
    }
    return id;
  };
  const links = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const c0 = V(i, j) < 0;
      const c1 = V(i + 1, j) < 0;
      const c2 = V(i + 1, j + 1) < 0;
      const c3 = V(i, j + 1) < 0;
      const mask = (c0 ? 1 : 0) | (c1 ? 2 : 0) | (c2 ? 4 : 0) | (c3 ? 8 : 0);
      if (mask === 0 || mask === 15) continue;
      const T = () => edgePoint(`h${i},${j}`, i, j, i + 1, j);
      const B = () => edgePoint(`h${i},${j + 1}`, i, j + 1, i + 1, j + 1);
      const L = () => edgePoint(`v${i},${j}`, i, j, i, j + 1);
      const R = () => edgePoint(`v${i + 1},${j}`, i + 1, j, i + 1, j + 1);
      switch (mask) {
        case 1: case 14: link(L(), T()); break;
        case 2: case 13: link(T(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(R(), B()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(L(), B()); break;
        case 5:
        case 10: {
          const center = (V(i, j) + V(i + 1, j) + V(i + 1, j + 1) + V(i, j + 1)) / 4 < 0;
          const sepOutsides = (mask === 5) === center;
          if (sepOutsides) {
            link(T(), R());
            link(L(), B());
          } else {
            link(L(), T());
            link(R(), B());
          }
          break;
        }
      }
    }
  }
  const visited = new Set<string>();
  const rings: Ring[] = [];
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const ring: Ring = [];
    let prev = '';
    let cur = start;
    while (!visited.has(cur)) {
      visited.add(cur);
      ring.push(pointOnEdge.get(cur)!);
      const nbrs = links.get(cur)!;
      const next = nbrs.find((n) => n !== prev && !visited.has(n)) ?? nbrs.find((n) => !visited.has(n));
      if (!next) break;
      prev = cur;
      cur = next;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

export function ringToPath(r: Ring, close = true, digits = 3): string {
  const f = (n: number) => String(+n.toFixed(digits));
  let d = '';
  r.forEach((p, i) => {
    d += `${i === 0 ? 'M' : 'L'}${f(p[0])} ${f(p[1])}`;
  });
  return close ? `${d}Z` : d;
}

export function shapeToPath(shape: Shape, digits = 3): string {
  return shape.map((r) => ringToPath(r, true, digits)).join('');
}
