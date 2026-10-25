import { describe, expect, it } from 'vitest';
import { bbox } from '../src/geometry';
import { History, createDesign, makeElement, pickElement, worldShape, isTooThin, type El } from '../src/model';
import { SHAPE_IDS, baseShape } from '../src/shapes';

const mk = (id: (typeof SHAPE_IDS)[number], x: number, y: number, size = 40): El =>
  makeElement({ kind: 'shape', ref: id, rings: baseShape(id), op: 'cut', size, x, y });

describe('Datenmodell', () => {
  it('legt Formen in mm an und normiert die Basis', () => {
    for (const id of SHAPE_IDS) {
      const e = mk(id, 100, 80, 40);
      const b = bbox(e.base);
      expect(b.maxX - b.minX).toBeCloseTo(1, 6);
      expect(b.maxY - b.minY).toBeCloseTo(1, 6);
      expect(Math.max(e.w, e.h)).toBeCloseTo(40, 6);
      const wb = bbox(worldShape(e));
      expect((wb.minX + wb.maxX) / 2).toBeCloseTo(100, 6);
      expect((wb.minY + wb.maxY) / 2).toBeCloseTo(80, 6);
    }
  });

  it('dreht Elemente in der Weltdarstellung', () => {
    const e = mk('square', 50, 50, 20);
    e.rot = 45;
    const wb = bbox(worldShape(e));
    expect(wb.maxX - wb.minX).toBeCloseTo(20 * Math.SQRT2, 6);
  });

  it('wählt das oberste Element und ignoriert leere Stellen', () => {
    const a = mk('square', 50, 50);
    const b = mk('circle', 60, 50);
    expect(pickElement([a, b], [60, 50], 1)?.id).toBe(b.id);
    expect(pickElement([a, b], [500, 500], 1)).toBeNull();
  });

  it('warnt bei zu dünnen Formen', () => {
    const thin = makeElement({ kind: 'shape', ref: 'square', rings: baseShape('square'), op: 'fill', size: 1, x: 0, y: 0, exact: { w: 40, h: 1 } });
    expect(isTooThin(thin, 3)).toBe(true);
    expect(isTooThin(mk('square', 0, 0, 30), 3)).toBe(false);
  });
});

describe('Rückgängig', () => {
  it('geht Schritt für Schritt zurück und wieder vor', () => {
    const d = createDesign();
    const h = new History(d.elements);
    const a = mk('circle', 50, 50);
    const b = mk('star', 90, 50);
    const c = mk('heart', 130, 50);
    expect(h.commit([a])).toBe(true);
    expect(h.commit([a, b])).toBe(true);
    expect(h.commit([a, b, c])).toBe(true);
    expect(h.commit([a, b, c])).toBe(false);
    expect(h.undo()).toHaveLength(2);
    expect(h.undo()).toHaveLength(1);
    expect(h.redo()).toHaveLength(2);
    expect(h.commit([a])).toBe(true); // neuer Zweig löscht "Wiederholen"
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toHaveLength(2);
  });
});
