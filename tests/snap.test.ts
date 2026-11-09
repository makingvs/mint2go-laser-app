import { describe, expect, it } from 'vitest';
import { snapMove, snapTolerance, type Box } from '../src/snap';

const box = (x: number, y: number, w: number, h: number): Box => ({ minX: x, maxX: x + w, minY: y, maxY: y + h });

describe('Fangen', () => {
  it('Kante rastet an Kante ein', () => {
    const r = snapMove(box(53, 0, 20, 20), [box(0, 0, 50, 50)], 5);
    expect(r.dx).toBeCloseTo(-3, 9); // linke Kante 53 -> rechte Kante 50
    expect(r.guides.some((g) => g.axis === 'x' && g.pos === 50)).toBe(true);
  });

  it('Mitte rastet an Mitte ein (beide Richtungen)', () => {
    const r = snapMove(box(37, 38, 20, 20), [box(0, 0, 100, 100)], 5);
    // Mitte des Teils = (47, 48), Mitte des Ziels = (50, 50)
    expect(r.dx).toBeCloseTo(3, 9);
    expect(r.dy).toBeCloseTo(2, 9);
    expect(r.guides).toHaveLength(2);
  });

  it('außerhalb des Fangabstands bleibt alles, wie es ist', () => {
    const r = snapMove(box(80, 80, 10, 10), [box(0, 0, 50, 50)], 5);
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] });
    expect(snapMove(box(0, 0, 10, 10), [], 5)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('nimmt den nächsten Treffer', () => {
    // Linien des Teils bei 21, 23, 25: Ziele bei 20 (Abstand 1) und 27 (Abstand 2)
    const r = snapMove(box(21, 0, 4, 5), [box(20, 100, 0, 1), box(27, 200, 0, 1)], 5);
    expect(r.dx).toBeCloseTo(-1, 9);
  });

  it('rastet an der Zeichenfläche (Rand und Mitte) ein', () => {
    const surface = box(0, 0, 200, 120);
    const r = snapMove(box(-2, 99, 30, 20), [surface], 4); // links am Rand, unten fast am Rand (Unterkante 119)
    expect(r.dx).toBeCloseTo(2, 9);
    expect(r.dy).toBeCloseTo(1, 9);
  });

  it('Führungslinie reicht über beide Teile', () => {
    const r = snapMove(box(50, 100, 10, 10), [box(50, 0, 10, 20)], 3);
    const g = r.guides.find((x) => x.axis === 'x')!;
    expect(g.a).toBe(0);
    expect(g.b).toBe(110);
  });

  it('Fangabstand folgt dem Zoom (Pixel * mm pro Pixel)', () => {
    expect(snapTolerance(0.5, 10)).toBeCloseTo(5, 9);
    expect(snapTolerance(0.1)).toBeCloseTo(0.9, 9);
  });
});
