import { describe, expect, it } from 'vitest';
import { baseShape, SHAPE_IDS } from '../src/shapes';
import { signedArea, type Pt, type Shape } from '../src/geometry';
import { textShape } from '../src/text';
import { extrudeMesh, normalizeOutline, triangulate } from '../app3d/src/extrude';
import { meshVolume, type TriMesh } from '../app3d/src/mesh';

const sq = (r: number, cw = false): Pt[] => {
  const p: Pt[] = [[-r, -r], [r, -r], [r, r], [-r, r]];
  return cw ? p.reverse() : p;
};
const circle = (r: number, n: number, cw = false): Pt[] => {
  const p = Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)] as Pt);
  return cw ? p.reverse() : p;
};
const area = (s: Shape): number => s.reduce((a, r) => a + signedArea(r), 0);

const key = (p: number[], i: number): string => `${p[i * 3].toFixed(6)},${p[i * 3 + 1].toFixed(6)},${p[i * 3 + 2].toFixed(6)}`;
/** Geschlossen und sauber orientiert: jede Kante kommt genau einmal in jede Richtung vor (entartete Dreiecke ausgenommen). */
function edgeProblems(m: TriMesh): string[] {
  const seen = new Map<string, number>();
  for (let t = 0; t < m.idx.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = key(m.pos, m.idx[t + k]);
      const b = key(m.pos, m.idx[t + ((k + 1) % 3)]);
      seen.set(`${a}>${b}`, (seen.get(`${a}>${b}`) ?? 0) + 1);
    }
  const bad: string[] = [];
  for (const [e, n] of seen) {
    const [a, b] = e.split('>');
    if (n !== 1) bad.push(`doppelt ${e}`);
    if (seen.get(`${b}>${a}`) !== 1) bad.push(`offen ${e}`);
  }
  return bad;
}

/** Fläche der Dreiecke des Deckels */
function capArea(rings: Shape): number {
  const pts = rings.flat();
  const t = triangulate(rings);
  let a = 0;
  for (let i = 0; i < t.length; i += 3) {
    const [p, q, r] = [pts[t[i]], pts[t[i + 1]], pts[t[i + 2]]];
    const ar = ((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2;
    expect(ar).toBeGreaterThanOrEqual(-1e-12); // gegen den Uhrzeigersinn
    a += ar;
  }
  return a;
}

const L: Pt[] = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0], [0, 0], [0, 0.5], [-0.5, 0.5]];
const cases: [string, Shape][] = [
  ['Quadrat', [sq(0.5)]],
  ['L-Form', [L]],
  ['Kreis', [circle(0.5, 120)]],
  ['Rahmen (Loch)', [sq(0.5), sq(0.25, true)]],
  ['Loch außermittig', [sq(0.5), [[-0.4, -0.1], [-0.1, -0.1], [-0.1, 0.1], [-0.4, 0.1]].reverse() as Pt[]]],
  ['zwei Löcher', [sq(0.5), [[-0.4, -0.3], [-0.1, -0.3], [-0.1, 0.3], [-0.4, 0.3]].reverse() as Pt[], [[0.1, -0.3], [0.4, -0.3], [0.4, 0.3], [0.1, 0.3]].reverse() as Pt[]]],
  ['Insel im Loch', [sq(0.5), sq(0.4, true), sq(0.2)]],
  ['Ring aus Kreisen', [circle(0.5, 96), circle(0.3, 64, true)]],
  ['zwei getrennte Teile', [sq(0.2).map(([x, y]) => [x - 0.3, y] as Pt), sq(0.2).map(([x, y]) => [x + 0.3, y] as Pt)]],
];

describe('Extrusion', () => {
  it.each(cases)('%s: Deckel füllt genau die Fläche', (_name, s) => {
    expect(capArea(s)).toBeCloseTo(area(s), 9);
  });

  it.each(cases)('%s: Körper ist geschlossen und hat die Fläche als Rauminhalt', (_name, s) => {
    const m = extrudeMesh(s);
    expect(edgeProblems(m)).toEqual([]);
    expect(meshVolume(m)).toBeCloseTo(area(s), 9);
  });

  it('liegt im Einheitsquader (z von 0 bis 1)', () => {
    const m = extrudeMesh([sq(0.5)]);
    const zs = m.pos.filter((_, i) => i % 3 === 2);
    expect(Math.min(...zs)).toBe(0);
    expect(Math.max(...zs)).toBe(1);
  });
});

describe('Umriss normieren', () => {
  it('spiegelt y (Laser: nach unten -> 3D: nach hinten), zentriert und liefert Maße', () => {
    // Dreieck: Spitze oben (kleines y in Laser-Koordinaten), Breite 20, Höhe 10, Ecke bei (100, 50)
    const r = normalizeOutline([[[110, 50], [120, 60], [100, 60]]])!;
    expect(r.w).toBeCloseTo(20, 9);
    expect(r.d).toBeCloseTo(10, 9);
    const ring = r.outline[0];
    expect(Math.max(...ring.map((p) => p[0]))).toBeCloseTo(0.5, 4);
    expect(Math.min(...ring.map((p) => p[1]))).toBeCloseTo(-0.5, 4);
    // Spitze zeigt jetzt nach hinten (+y)
    const apex = ring.reduce((a, p) => (p[1] > a[1] ? p : a));
    expect(apex[0]).toBeCloseTo(0, 4);
    expect(apex[1]).toBeCloseTo(0.5, 4);
    expect(signedArea(ring)).toBeGreaterThan(0); // Außenring gegen den Uhrzeigersinn
  });

  it('leere Form -> null', () => {
    expect(normalizeOutline([])).toBeNull();
    expect(normalizeOutline([[[0, 0], [1, 1]]])).toBeNull();
  });

  it('Löcher bleiben im Uhrzeigersinn', () => {
    const r = normalizeOutline([[[0, 0], [10, 0], [10, 10], [0, 10]], [[3, 3], [7, 3], [7, 7], [3, 7]]])!;
    expect(r.outline.map(signedArea).map(Math.sign).sort()).toEqual([-1, 1]);
  });
});

describe('Körper aus echten Laser-Formen und Text', () => {
  it.each(SHAPE_IDS)('Form %s ergibt einen geschlossenen Körper', (id) => {
    const n = normalizeOutline(baseShape(id))!;
    const m = extrudeMesh(n.outline);
    expect(edgeProblems(m)).toEqual([]);
    expect(meshVolume(m)).toBeCloseTo(area(n.outline), 8);
    expect(meshVolume(m)).toBeGreaterThan(0.01);
  });

  it('Text "ABC 08" (Löcher in A, B, 0, 8) ergibt einen geschlossenen Körper', () => {
    const n = normalizeOutline(textShape('ABC 08'))!;
    expect(n.outline.length).toBeGreaterThan(6); // Außenringe und Löcher
    const m = extrudeMesh(n.outline);
    expect(edgeProblems(m)).toEqual([]);
    expect(meshVolume(m)).toBeCloseTo(area(n.outline), 8);
  });
});
