// Umriss -> Körper (Extrusion), selbst geschrieben: Umriss mit Löchern wird in Dreiecke zerlegt
// (Ear-Clipping, Löcher über Brücken verbunden) und zu einem geschlossenen Netz mit Wänden aufgezogen.
// Umrisse sind "normiert": x, y in [-0.5, 0.5] (y nach hinten), Außenringe gegen den Uhrzeigersinn,
// Löcher im Uhrzeigersinn. Das Netz liegt im Einheitsquader (z von 0 bis 1) wie bei mesh.ts.
import { bbox, normalizeShape, signedArea, type Pt, type Ring, type Shape } from '../../src/geometry';
import type { TriMesh } from './mesh';

/**
 * Form aus der Laser-App (y nach unten, beliebige Einheit) in einen normierten Umriss umwandeln.
 * Liefert zusätzlich die natürliche Breite und Tiefe in der Ausgangseinheit; null bei leerer Form.
 */
export function normalizeOutline(shape: Shape): { outline: Shape; w: number; d: number } | null {
  const flipped = shape.map((r) => r.map(([x, y]) => [x, -y] as Pt));
  const rings = normalizeShape(flipped); // Außenringe positiv (gegen den Uhrzeigersinn), Löcher negativ
  if (rings.length === 0) return null;
  const b = bbox(rings);
  const w = Math.max(b.maxX - b.minX, 1e-6);
  const d = Math.max(b.maxY - b.minY, 1e-6);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const round = (v: number): number => Math.round(v * 1e5) / 1e5;
  const outline = rings.map((r) => r.map(([x, y]) => [round((x - cx) / w), round((y - cy) / d)] as Pt));
  return { outline, w, d };
}

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;
const orient = (a: Pt, b: Pt, c: Pt): number => cross(b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1]);

/** Schneiden sich die Strecken echt (ohne gemeinsame Endpunkte)? */
function properCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
}

/** Liegt p im Dreieck (a, b, c) (gegen den Uhrzeigersinn), Rand eingeschlossen? */
function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
  return orient(a, b, p) >= 0 && orient(b, c, p) >= 0 && orient(c, a, p) >= 0;
}

function pointInRing(p: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Zerlegt einen Umriss in Dreiecke. Rückgabe: Dreiecke als Nummern in der aneinandergehängten Punktliste
 * aller Ringe (erst Ring 0, dann Ring 1, ...). Jedes Dreieck läuft gegen den Uhrzeigersinn.
 */
export function triangulate(rings: Shape): number[] {
  const pts: Pt[] = rings.flat();
  const starts: number[] = [];
  let n = 0;
  for (const r of rings) {
    starts.push(n);
    n += r.length;
  }
  const ids = (ri: number): number[] => Array.from({ length: rings[ri].length }, (_, i) => starts[ri] + i);

  const outers: number[] = [];
  const holes: number[] = [];
  rings.forEach((r, i) => (signedArea(r) > 0 ? outers : holes).push(i));
  // Jedes Loch gehört zum kleinsten Außenring, der es umschließt
  const holesOf = new Map<number, number[]>(outers.map((o) => [o, []]));
  for (const h of holes) {
    let best = -1;
    for (const o of outers) {
      if (pointInRing(rings[h][0], rings[o]) && (best < 0 || Math.abs(signedArea(rings[o])) < Math.abs(signedArea(rings[best])))) best = o;
    }
    if (best >= 0) holesOf.get(best)!.push(h);
  }

  const out: number[] = [];
  for (const o of outers) {
    const poly = bridgeHoles(ids(o), (holesOf.get(o) ?? []).map(ids), pts);
    earClip(poly, pts, out);
  }
  return out;
}

/** Löcher über Brücken in den Außenring einhängen (ein einziger Umlauf; Brückenpunkte kommen doppelt vor). */
function bridgeHoles(outer: number[], holes: number[][], pts: Pt[]): number[] {
  let poly = outer;
  const order = holes.map((h) => ({ h, k: h.reduce((best, id, i) => (pts[id][0] < pts[h[best]][0] ? i : best), 0) })).sort((a, b) => pts[a.h[a.k]][0] - pts[b.h[b.k]][0]);
  const pending = order.map((o) => o.h);
  for (const { h, k } of order) {
    pending.splice(pending.indexOf(h), 1);
    const H = pts[h[k]];
    // mögliche Brückenpunkte, die nächsten zuerst; der erste mit freier Sicht gewinnt
    const cand = poly.map((id, pos) => ({ id, pos, d: (pts[id][0] - H[0]) ** 2 + (pts[id][1] - H[1]) ** 2 })).sort((a, b) => a.d - b.d);
    let chosen: { id: number; pos: number } | null = null;
    for (const c of cand) {
      if (visible(H, h[k], c.id, poly, h, pending, pts)) {
        chosen = c;
        break;
      }
    }
    if (!chosen) chosen = cand[0]; // zur Not die nächste Ecke (nur bei entarteten Umrissen)
    // Vorkommen des Brückenpunkts wählen, in dessen Ecke die Brücke hineinzeigt
    let pos = chosen.pos;
    for (let q = 0; q < poly.length; q++) {
      if (poly[q] !== chosen.id) continue;
      const a = pts[poly[(q + poly.length - 1) % poly.length]];
      const P = pts[chosen.id];
      const b = pts[poly[(q + 1) % poly.length]];
      const convex = orient(a, P, b) >= 0;
      const inside = convex ? orient(a, P, H) > 0 && orient(P, b, H) > 0 : orient(a, P, H) > 0 || orient(P, b, H) > 0;
      if (inside) {
        pos = q;
        break;
      }
    }
    const loop: number[] = [];
    for (let i = 0; i <= h.length; i++) loop.push(h[(k + i) % h.length]);
    poly = [...poly.slice(0, pos + 1), ...loop, chosen.id, ...poly.slice(pos + 1)];
  }
  return poly;
}

/** Hat die Strecke H–P freie Sicht (kreuzt keine Kante des Umlaufs, des eigenen Lochs oder anderer Löcher)? */
function visible(H: Pt, hid: number, pid: number, poly: number[], own: number[], others: number[][], pts: Pt[]): boolean {
  const P = pts[pid];
  const check = (a: number, b: number): boolean => a === hid || b === hid || a === pid || b === pid || !properCross(H, P, pts[a], pts[b]);
  for (let i = 0; i < poly.length; i++) if (!check(poly[i], poly[(i + 1) % poly.length])) return false;
  for (let i = 0; i < own.length; i++) if (!check(own[i], own[(i + 1) % own.length])) return false;
  for (const o of others) for (let i = 0; i < o.length; i++) if (!check(o[i], o[(i + 1) % o.length])) return false;
  return true;
}

/** Ear-Clipping eines einfachen Umlaufs (gegen den Uhrzeigersinn). Dreiecke kommen an `out`. */
function earClip(poly: number[], pts: Pt[], out: number[]): void {
  const m = poly.length;
  if (m < 3) return;
  const prev = poly.map((_, i) => (i + m - 1) % m);
  const next = poly.map((_, i) => (i + 1) % m);
  const alive = new Array<boolean>(m).fill(true);
  const P = (i: number): Pt => pts[poly[i]];

  const emit = (a: number, b: number, c: number): void => {
    const ia = poly[a];
    const ib = poly[b];
    const ic = poly[c];
    if (ia !== ib && ib !== ic && ia !== ic) out.push(ia, ib, ic);
  };
  const isEar = (i: number): boolean => {
    const a = prev[i];
    const c = next[i];
    if (orient(P(a), P(i), P(c)) < 0) return false; // Ecke zeigt nach innen (reflex)
    const ids = [poly[a], poly[i], poly[c]];
    for (let j = next[c]; j !== a; j = next[j]) {
      if (ids.includes(poly[j])) continue;
      if (inTriangle(P(j), P(a), P(i), P(c))) return false;
    }
    return true;
  };
  const remove = (i: number): void => {
    next[prev[i]] = next[i];
    prev[next[i]] = prev[i];
    alive[i] = false;
  };

  let count = m;
  let cur = 0;
  let stop = cur;
  while (count > 3) {
    if (isEar(cur)) {
      emit(prev[cur], cur, next[cur]);
      const nx = next[cur];
      remove(cur);
      count--;
      cur = nx;
      stop = cur;
      continue;
    }
    cur = next[cur];
    if (cur === stop) {
      // kein Ohr gefunden (entarteter Umriss): die flachste Ecke abschneiden, damit das Netz geschlossen bleibt
      let best = cur;
      let bestVal = -Infinity;
      let i = cur;
      do {
        const v = orient(P(prev[i]), P(i), P(next[i]));
        if (v > bestVal) {
          bestVal = v;
          best = i;
        }
        i = next[i];
      } while (i !== cur);
      emit(prev[best], best, next[best]);
      const nx = next[best];
      remove(best);
      count--;
      cur = nx;
      stop = cur;
    }
  }
  const a = cur;
  emit(prev[a], a, next[a]);
}

/** Körper aus einem normierten Umriss: Boden bei z = 0, Deckel bei z = 1, Wände aus den Ringkanten. */
export function extrudeMesh(outline: Shape): TriMesh {
  const pos: number[] = [];
  const idx: number[] = [];
  const bottom: number[][] = [];
  const top: number[][] = [];
  let n = 0;
  for (const r of outline) {
    const b: number[] = [];
    const t: number[] = [];
    for (const [x, y] of r) {
      pos.push(x, y, 0);
      b.push(n);
      pos.push(x, y, 1);
      t.push(n + 1);
      n += 2;
    }
    bottom.push(b);
    top.push(t);
  }
  // Wände
  outline.forEach((r, ri) => {
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      const b0 = bottom[ri][i];
      const b1 = bottom[ri][j];
      const t0 = top[ri][i];
      const t1 = top[ri][j];
      idx.push(b0, b1, t1, b0, t1, t0);
    }
  });
  // Deckel und Boden: Dreiecke beziehen sich auf die Punktliste aller Ringe
  const flatTop = top.flat();
  const flatBottom = bottom.flat();
  const tris = triangulate(outline);
  for (let i = 0; i < tris.length; i += 3) {
    idx.push(flatTop[tris[i]], flatTop[tris[i + 1]], flatTop[tris[i + 2]]);
    idx.push(flatBottom[tris[i]], flatBottom[tris[i + 2]], flatBottom[tris[i + 1]]);
  }
  return { pos, idx };
}

const cache = new Map<string, TriMesh>();

/** Netz zu einem Umriss mit Nummer (gemeinsam genutzt, nicht verändern). */
export function outlineMesh(id: string, outline: Shape): TriMesh {
  let m = cache.get(id);
  if (!m) {
    m = extrudeMesh(outline);
    cache.set(id, m);
  }
  return m;
}
