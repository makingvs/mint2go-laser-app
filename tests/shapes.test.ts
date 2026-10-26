import { describe, expect, it } from 'vitest';
import { bbox, pointInShape, shapeArea } from '../src/geometry';
import { SHAPE_GROUPS, SHAPE_IDS, SHAPE_LABELS, baseShape } from '../src/shapes';
import { SHAPE_ICONS } from '../src/icons';
import { makeElement, worldShape } from '../src/model';

describe('vorgefertigte Formen', () => {
  it('es gibt viele Formen in drei Gruppen, jede genau einmal, mit Namen und Symbol', () => {
    expect(SHAPE_IDS.length).toBeGreaterThanOrEqual(25);
    expect(SHAPE_GROUPS).toHaveLength(3);
    expect(new Set(SHAPE_IDS).size).toBe(SHAPE_IDS.length);
    for (const id of SHAPE_IDS) {
      expect(SHAPE_LABELS[id], id).toBeTruthy();
      expect(SHAPE_ICONS[id], id).toContain('<path');
    }
  });

  it('jede Form hat gültige Umrisse mit Fläche und lässt sich als Teil einfügen', () => {
    for (const id of SHAPE_IDS) {
      const s = baseShape(id);
      expect(s.length, id).toBeGreaterThan(0);
      for (const r of s) {
        expect(r.length, id).toBeGreaterThanOrEqual(3);
        for (const [x, y] of r) {
          expect(Number.isFinite(x) && Number.isFinite(y), id).toBe(true);
        }
      }
      expect(shapeArea(s), id).toBeGreaterThan(0.05);
      const e = makeElement({ kind: 'shape', ref: id, rings: s, op: 'cut', size: 40, x: 100, y: 80 });
      const b = bbox(worldShape(e));
      expect(Math.max(b.maxX - b.minX, b.maxY - b.minY), id).toBeCloseTo(40, 4);
    }
  });

  it('Ring und Rahmen haben ein Loch', () => {
    for (const id of ['ring', 'frame'] as const) {
      const s = baseShape(id);
      expect(s, id).toHaveLength(2);
      expect(pointInShape([0, 0], s), id).toBe(false);
      expect(pointInShape([0.75, 0], s), id).toBe(true);
    }
    expect(shapeArea(baseShape('ring'))).toBeCloseTo(Math.PI * (1 - 0.25), 1);
  });

  it('Halbkreis, Viertelkreis, Mond und Wolke stimmen in Form und Fläche', () => {
    expect(shapeArea(baseShape('semicircle'))).toBeCloseTo(Math.PI / 2, 1);
    expect(shapeArea(baseShape('quarter'))).toBeCloseTo(Math.PI / 4, 1);
    const moon = baseShape('moon');
    expect(moon).toHaveLength(1);
    expect(shapeArea(moon)).toBeLessThan(Math.PI * 0.6); // Sichel, kein Vollkreis
    expect(pointInShape([-0.85, 0], moon)).toBe(true); // linker Rand der Sichel
    expect(pointInShape([0.3, 0], moon)).toBe(false); // ausgeschnittener Teil
    expect(baseShape('cloud')).toHaveLength(1); // vereint zu einem Umriss
    expect(baseShape('flower')).toHaveLength(1);
    expect(baseShape('speech')).toHaveLength(1);
  });

  it('Tropfen läuft oben spitz zu und ist unten rund', () => {
    const d = baseShape('drop')[0];
    const top = d.reduce((m, p) => Math.min(m, p[1]), 9);
    expect(top).toBeCloseTo(-1, 6);
    const widthAt = (y: number) => d.filter((p) => Math.abs(p[1] - y) < 0.06).map((p) => p[0]);
    const lower = widthAt(0.35);
    expect(Math.max(...lower) - Math.min(...lower)).toBeGreaterThan(1.1);
  });
});
