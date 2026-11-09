import { describe, expect, it } from 'vitest';
import { BOX_DEFAULTS, area, boxPanels, cubeEdge, fingerCount, fitTestParts, fitTestSheet, fitsBed, layout, offsetRectilinear, panelOutline, pattern, type BoxParams, type Panel, type Pt } from '../src/boxgen';
import { pointInShape } from '../src/geometry';

const params = (o: Partial<BoxParams> = {}): BoxParams => ({ ...BOX_DEFAULTS, kerf: 0, fit: 0, ...o });
const bb = (pts: Pt[]) => ({ minX: Math.min(...pts.map((p) => p[0])), maxX: Math.max(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])), maxY: Math.max(...pts.map((p) => p[1])) });

describe('Kanten und Zinken', () => {
  it('Zinkenzahl ist ungerade, mindestens 3 und nicht zu schmal', () => {
    for (const len of [40, 66, 86, 120, 200]) {
      const n = fingerCount(len, 10, 4.5)!;
      expect(n % 2).toBe(1);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(len / n).toBeGreaterThanOrEqual(4.5 - 1e-9);
    }
    expect(fingerCount(10, 10, 4.5)).toBeNull();
  });

  it('die zwei Teile einer Kante ergänzen sich in jedem Abschnitt', () => {
    const a = pattern(60, 5, 3, true);
    const b = pattern(60, 5, 3, false);
    a.rec.forEach((r, i) => expect(r + b.rec[i]).toBe(3));
    const c = cubeEdge(60, 3, 3, true);
    expect(c.bounds[0]).toBe(0);
    expect(c.bounds[1]).toBe(3);
    expect(c.bounds[c.bounds.length - 1]).toBe(60);
    expect(c.rec[0]).toBe(3);
    expect(c.rec[c.rec.length - 1]).toBe(3);
  });

  it('Umriss ist ein Rechteck mit rechten Winkeln und liegt in a × b', () => {
    const pts = panelOutline(60, 40, { bottom: pattern(60, 5, 3, true), right: pattern(40, 3, 3, true), top: pattern(60, 5, 3, true), left: pattern(40, 3, 3, true) });
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      expect(p[0] === q[0] || p[1] === q[1]).toBe(true);
    }
    const b = bb(pts);
    expect([b.minX, b.maxX, b.minY, b.maxY]).toEqual([0, 60, 0, 40]);
    expect(area(pts)).toBeGreaterThan(0);
  });
});

describe('Schnittbreite (Kerf)', () => {
  it('Versatz nach außen vergrößert das Teil um die Schnittbreite', () => {
    const r: Pt[] = [[0, 0], [50, 0], [50, 30], [0, 30]];
    const o = offsetRectilinear(r, 0.1);
    const b = bb(o);
    expect(b.maxX - b.minX).toBeCloseTo(50.2, 9);
    expect(b.maxY - b.minY).toBeCloseTo(30.2, 9);
    // Zinken werden breiter, Lücken schmaler: die Fläche wächst
    const t = panelOutline(60, 40, { bottom: pattern(60, 5, 3, true), right: pattern(40, 3, 3, true), top: pattern(60, 5, 3, true), left: pattern(40, 3, 3, true) });
    expect(area(offsetRectilinear(t, 0.1))).toBeGreaterThan(area(t));
    expect(area(offsetRectilinear(t, -0.1))).toBeLessThan(area(t));
  });

  it('Teile bekommen (Schnittbreite − Passung) / 2 Zugabe je Seite', () => {
    const r = boxPanels({ ...BOX_DEFAULTS, kerf: 0.2, fit: 0.1 });
    if (!r.ok) throw new Error(r.error);
    const lid = r.panels.find((p) => p.id === 'lid')!;
    const b = bb(lid.cut);
    expect(b.maxX - b.minX).toBeCloseTo(lid.a + 0.1, 9);
  });
});

/** Alle Teile in den Raum stellen und prüfen: Hülle der Box ganz gefüllt, kein Würfel doppelt belegt. */
function solidCheck(p: BoxParams, step = 0.5): { gaps: number; overlaps: number; shell: number } {
  const r = boxPanels(p);
  if (!r.ok) throw new Error(r.error);
  const { w: W, d: D } = r.outer;
  const Hw = r.wallHeight;
  const Ht = Hw + (p.lid === 'loose' ? p.thickness : 0);
  const t = p.thickness;
  const polys = new Map(r.panels.map((q) => [q.id, [q.nominal]]));
  const inside = (id: Panel['id'], u: number, v: number) => pointInShape([u, v], polys.get(id)!);
  const covers = (x: number, y: number, z: number): number => {
    let n = 0;
    if (y < t && inside('front', x, z)) n++;
    if (y > D - t && inside('back', x, z)) n++;
    if (x < t && inside('left', y, z)) n++;
    if (x > W - t && inside('right', y, z)) n++;
    if (z < t && inside('bottom', x, y)) n++;
    if (p.lid === 'fingers' && z > Hw - t && inside('top', x, y)) n++;
    if (p.lid === 'loose' && z > Hw && inside('lid', x, y)) n++;
    return n;
  };
  const isShell = (x: number, y: number, z: number): boolean => {
    if (p.lid === 'loose' && z > Hw) return true; // Deckelplatte
    const cavity = x > t && x < W - t && y > t && y < D - t && z > t && (p.lid === 'fingers' ? z < Hw - t : true);
    return !cavity;
  };
  let gaps = 0;
  let overlaps = 0;
  let shell = 0;
  for (let x = step / 2; x < W; x += step) {
    for (let y = step / 2; y < D; y += step) {
      for (let z = step / 2; z < Ht; z += step) {
        const c = covers(x, y, z);
        const s = isShell(x, y, z);
        if (s) shell++;
        if (c > 1) overlaps++;
        if (s && c === 0) gaps++;
        if (!s && c > 0) overlaps++; // Material im Hohlraum
      }
    }
  }
  return { gaps, overlaps, shell };
}

describe('Box: Teile passen im Raum zusammen', () => {
  for (const lid of ['fingers', 'loose', 'none'] as const) {
    it(`Deckel ${lid}: keine Lücke, keine Überschneidung`, () => {
      const r = solidCheck(params({ w: 50, d: 40, h: 30, lid }));
      expect(r.shell).toBeGreaterThan(1000);
      expect(r.gaps).toBe(0);
      expect(r.overlaps).toBe(0);
    });
  }

  it('auch mit Außenmaßen, anderer Dicke und ungeraden Maßen', () => {
    for (const o of [
      { w: 66, d: 47, h: 38, inner: false, lid: 'fingers' as const, thickness: 3 },
      { w: 90, d: 55, h: 45, inner: true, lid: 'none' as const, thickness: 4, finger: 12 },
      { w: 70, d: 70, h: 70, inner: true, lid: 'fingers' as const, thickness: 2 },
    ]) {
      const r = solidCheck(params(o), 1);
      expect(r.gaps).toBe(0);
      expect(r.overlaps).toBe(0);
    }
  });
});

describe('Box: Maße und Fehler', () => {
  it('Innenmaße: Außen = Innen + 2 × Dicke, Höhe je nach Deckel', () => {
    const f = boxPanels(params({ w: 80, d: 60, h: 40, lid: 'fingers' }));
    const o = boxPanels(params({ w: 80, d: 60, h: 40, lid: 'none' }));
    if (!f.ok || !o.ok) throw new Error('ok');
    expect(f.outer).toEqual({ w: 86, d: 66, h: 46 });
    expect(o.outer.h).toBe(43);
  });

  it('Teileanzahl: offen 5, lose 6, mit Zinken 6', () => {
    for (const [lid, n] of [['none', 5], ['loose', 6], ['fingers', 6]] as const) {
      const r = boxPanels(params({ lid }));
      expect(r.ok && r.panels.length).toBe(n);
    }
  });

  it('zu kleine Box meldet einen Fehler', () => {
    expect(boxPanels(params({ w: 8, d: 8, h: 8 })).ok).toBe(false);
    expect(boxPanels(params({ thickness: 0.5 })).ok).toBe(false);
  });
});

describe('Anordnung und Platte', () => {
  it('Teile überlappen sich nicht und bleiben in der Platte', () => {
    const r = boxPanels({ ...BOX_DEFAULTS });
    if (!r.ok) throw new Error('ok');
    const l = layout(r.panels, 200, 4);
    for (const a of l.placed) {
      const b = bb(a.ring);
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(l.w);
      expect(b.maxY).toBeLessThanOrEqual(l.h);
    }
    for (let i = 0; i < l.placed.length; i++) {
      for (let j = i + 1; j < l.placed.length; j++) {
        const a = bb(l.placed[i].ring);
        const c = bb(l.placed[j].ring);
        const apart = a.maxX <= c.minX || c.maxX <= a.minX || a.maxY <= c.minY || c.maxY <= a.minY;
        expect(apart).toBe(true);
      }
    }
  });

  it('prüft die Größe der S1-Arbeitsfläche (498 x 319)', () => {
    expect(fitsBed(300, 200)).toBe(true);
    expect(fitsBed(319, 498)).toBe(true);
    expect(fitsBed(500, 330)).toBe(false);
  });

  it('Passprobe: zwei Teile je Schnittbreite', () => {
    const t = fitTestParts(3, [0.05, 0.1, 0.15], 0);
    expect(t.panels).toHaveLength(6);
    expect(t.kerfOf).toEqual([0.05, 0.05, 0.1, 0.1, 0.15, 0.15]);
  });

  it('Passprobe-Blatt: 5 Paare und 5 Zahlen als je ein Teil, alles innerhalb des Blatts', () => {
    const s = fitTestSheet(3, [0.05, 0.1, 0.15, 0.2, 0.25], 0);
    expect(s.parts.filter((x) => x.op === 'cut')).toHaveLength(10);
    expect(s.parts.filter((x) => x.op === 'fill')).toHaveLength(5);
    for (const part of s.parts) {
      const b = bb(part.rings.flat());
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.minY).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(s.w);
      expect(b.maxY).toBeLessThanOrEqual(s.h);
    }
  });
});
