import { describe, expect, it } from 'vitest';
import { bbox, type Pt } from '../src/geometry';
import { boxPoints, measureLabel, snapToPoint } from '../src/measure';
import { hitTest, makeElement, worldShape, type El } from '../src/model';
import { ROUND_RATIO, baseShape, fittedBase } from '../src/shapes';
import { shortcutFor } from '../src/shortcuts';
import { buildPaths } from '../src/svgExport';

const key = (k: string, o: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o });

describe('Tastenkürzel', () => {
  it('Strg und Befehlstaste (auch groß geschrieben)', () => {
    expect(shortcutFor(key('c', { ctrlKey: true }))).toBe('copy');
    expect(shortcutFor(key('v', { metaKey: true }))).toBe('paste');
    expect(shortcutFor(key('V', { ctrlKey: true }))).toBe('paste');
    expect(shortcutFor(key('x', { ctrlKey: true }))).toBe('cut');
    expect(shortcutFor(key('z', { ctrlKey: true }))).toBe('undo');
    expect(shortcutFor(key('z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(shortcutFor(key('y', { ctrlKey: true }))).toBe('redo');
  });

  it('einzelne Tasten', () => {
    expect(shortcutFor(key('Delete'))).toBe('delete');
    expect(shortcutFor(key('Backspace'))).toBe('delete');
    expect(shortcutFor(key('Escape'))).toBe('deselect');
    expect(shortcutFor(key('ArrowLeft'))).toBe('left');
  });

  it('andere Tasten tun nichts', () => {
    expect(shortcutFor(key('c'))).toBeNull();
    expect(shortcutFor(key('a', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key('c', { ctrlKey: true, altKey: true }))).toBeNull();
  });
});

describe('Messen', () => {
  it('Länge und Abstände mit Komma', () => {
    expect(measureLabel([0, 0], [30, 40])).toEqual({ main: '50 mm', sub: '↔ 30  ↕ 40' });
    expect(measureLabel([10, 10], [10, 22.55]).main).toBe('12,6 mm');
  });

  it('rastet am nächsten Punkt ein, sonst bleibt der Punkt', () => {
    const pts: Pt[] = [[0, 0], [10, 0]];
    expect(snapToPoint([9, 1], pts, 3)).toEqual([10, 0]);
    expect(snapToPoint([5, 5], pts, 3)).toEqual([5, 5]);
    expect(snapToPoint([5, 5], [], 3)).toEqual([5, 5]);
  });

  it('Fangpunkte: Ecken, Kantenmitten, Mitte', () => {
    const p = boxPoints({ minX: 0, maxX: 10, minY: 0, maxY: 20 });
    expect(p).toHaveLength(9);
    expect(p).toContainEqual([5, 10]);
    expect(p).toContainEqual([10, 20]);
  });
});

describe('Runde Ecken beim Skalieren', () => {
  const round = (w: number, h: number): El => {
    const el = makeElement({ kind: 'shape', ref: 'roundrect', rings: baseShape('roundrect'), op: 'cut', size: 50, x: 100, y: 100 });
    el.w = w;
    el.h = h;
    return el;
  };
  /** Radius der Ecke oben rechts in x- und y-Richtung messen */
  const radii = (e: El): [number, number] => {
    const r = worldShape(e)[0];
    const b = bbox([r]);
    const onTop = r.filter((p) => Math.abs(p[1] - b.minY) < 1e-6).map((p) => p[0]);
    const onRight = r.filter((p) => Math.abs(p[0] - b.maxX) < 1e-6).map((p) => p[1]);
    return [b.maxX - Math.max(...onTop), Math.min(...onRight) - b.minY];
  };

  it('Ecken bleiben kreisrund, auch stark gestreckt', () => {
    for (const [w, h] of [[120, 60], [200, 20], [30, 150]]) {
      const [rx, ry] = radii(round(w, h));
      expect(rx).toBeCloseTo(ry, 6);
      expect(rx).toBeCloseTo(ROUND_RATIO * Math.min(w, h), 6);
    }
  });

  it('Maße stimmen und das Teil bleibt treffbar', () => {
    const e = round(120, 60);
    const b = bbox(worldShape(e));
    expect(b.maxX - b.minX).toBeCloseTo(120, 6);
    expect(b.maxY - b.minY).toBeCloseTo(60, 6);
    expect(hitTest(e, [100, 100], 1)).toBe('shape');
  });

  it('Sprechblase bleibt im Rahmen und behält runde Ecken', () => {
    const s = fittedBase('speech', 200, 60)!;
    const b = bbox(s);
    expect(b.maxX - b.minX).toBeCloseTo(1, 6);
    expect(b.maxY - b.minY).toBeCloseTo(1, 6);
    expect(b.minX).toBeCloseTo(-0.5, 6);
    expect(b.minY).toBeCloseTo(-0.5, 6);
  });

  it('andere Formen werden nicht angefasst', () => {
    expect(fittedBase('circle', 100, 40)).toBeNull();
    expect(fittedBase('star', 100, 40)).toBeNull();
  });

  it('der Export hat dieselben runden Ecken wie die Anzeige', () => {
    const e = round(120, 60);
    expect(buildPaths([e]).cut.closed[0].length).toBe(worldShape(e)[0].length);
  });
});
