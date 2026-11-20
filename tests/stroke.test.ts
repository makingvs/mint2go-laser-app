import { describe, expect, it } from 'vitest';
import { strokeToRing } from '../src/stroke';
import type { Pt } from '../src/geometry';

// zittriger Strich: Zickzack mit 0,8 mm Ausschlag entlang einer Linie
const shaky = (n = 60): Pt[] => Array.from({ length: n }, (_, i) => [i * 0.8, i % 2 ? 0.8 : 0] as Pt);
// fast geschlossener, wackliger Kreis (Lücke ca. 2 mm)
const wobblyCircle = (): Pt[] =>
  Array.from({ length: 80 }, (_, i) => {
    const a = (i / 80) * Math.PI * 2 * 0.985;
    const r = 20 + (i % 2 ? 0.6 : -0.6);
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });

describe('Freihand: wie gezeichnet', () => {
  it('lässt jeden Wackler stehen', () => {
    const raw = shaky();
    const res = strokeToRing(raw, 'raw', false)!;
    expect(res.closed).toBe(false);
    expect(res.ring).toEqual(raw);
  });

  it('entfernt nur doppelte Punkte', () => {
    const raw: Pt[] = [[0, 0], [0, 0], [5, 3], [5.01, 3], [10, 0], [15, 4]];
    const res = strokeToRing(raw, 'raw', false)!;
    expect(res.ring).toEqual([[0, 0], [5, 3], [10, 0], [15, 4]]);
  });

  it('schließt nur, wenn sich die Enden fast berühren oder Füllen gewählt ist', () => {
    const open: Pt[] = [[0, 0], [20, 0], [20, 20], [0, 20], [0, 5]];
    expect(strokeToRing(open, 'raw', false)!.closed).toBe(false); // Lücke 5 mm
    const almost: Pt[] = [[0, 0], [20, 0], [20, 20], [0, 20], [0, 2]];
    expect(strokeToRing(almost, 'raw', false)!.closed).toBe(true); // Lücke 2 mm
    expect(strokeToRing(open, 'raw', true)!.closed).toBe(true);
  });
});

describe('Freihand: geglättet (wie bisher)', () => {
  it('gleicht Wackler aus', () => {
    const res = strokeToRing(shaky(), 'smooth', false)!;
    expect(res.closed).toBe(false);
    expect(res.ring.length).toBeLessThan(10);
    const ys = res.ring.slice(1, -1).map((p) => p[1]); // Endpunkte bleiben, wo sie gezeichnet wurden
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.8);
  });

  it('schließt fast geschlossene Linien', () => {
    const smooth = strokeToRing(wobblyCircle(), 'smooth', false)!;
    expect(smooth.closed).toBe(true);
    expect(smooth.ring.length).toBeLessThan(wobblyCircle().length);
  });
});

describe('Freihand: zu kurze Striche', () => {
  it('werden in beiden Arten ignoriert', () => {
    const tap: Pt[] = [[0, 0], [1, 1], [2, 1]];
    expect(strokeToRing(tap, 'raw', false)).toBeNull();
    expect(strokeToRing(tap, 'smooth', false)).toBeNull();
  });
});
