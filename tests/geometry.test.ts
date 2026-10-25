import { describe, expect, it } from 'vitest';
import { bbox, featureSize, pointInShape, shapeArea, simplify, unionShapes, type Shape } from '../src/geometry';
import { baseShape } from '../src/shapes';

const sq = (x: number, y: number, s: number): Shape => [[[x, y], [x + s, y], [x + s, y + s], [x, y + s]]];

describe('unionShapes', () => {
  it('vereint zwei überlappende Quadrate', () => {
    const u = unionShapes([sq(0, 0, 10), sq(5, 5, 10)]);
    expect(u).toHaveLength(1);
    expect(shapeArea(u)).toBeCloseTo(100 + 100 - 25, 6);
    expect(u[0]).toHaveLength(8);
  });

  it('lässt getrennte Formen getrennt', () => {
    const u = unionShapes([sq(0, 0, 10), sq(20, 0, 10)]);
    expect(u).toHaveLength(2);
    expect(shapeArea(u)).toBeCloseTo(200, 6);
  });

  it('verschluckt ein vollständig enthaltenes Quadrat', () => {
    const u = unionShapes([sq(0, 0, 20), sq(5, 5, 5)]);
    expect(u).toHaveLength(1);
    expect(shapeArea(u)).toBeCloseTo(400, 6);
  });

  it('entfernt doppelte, deckungsgleiche Formen', () => {
    const u = unionShapes([sq(0, 0, 10), sq(0, 0, 10), sq(0, 0, 10)]);
    expect(u).toHaveLength(1);
    expect(shapeArea(u)).toBeCloseTo(100, 6);
  });

  it('verschmilzt Quadrate mit gemeinsamer Kante zu einem Rechteck', () => {
    const u = unionShapes([sq(0, 0, 10), sq(10, 0, 10)]);
    expect(u).toHaveLength(1);
    expect(shapeArea(u)).toBeCloseTo(200, 6);
    expect(u[0]).toHaveLength(4);
  });

  it('verschmilzt teilweise aneinanderliegende Kanten', () => {
    const u = unionShapes([sq(0, 0, 10), sq(10, 5, 10)]);
    expect(u).toHaveLength(1);
    expect(shapeArea(u)).toBeCloseTo(200, 6);
  });

  it('vereint überlappende Kreise (Fläche zwischen max und Summe)', () => {
    const c = baseShape('circle')[0].map(([x, y]) => [x * 10, y * 10] as [number, number]);
    const c2 = c.map(([x, y]) => [x + 10, y] as [number, number]);
    const u = unionShapes([[c], [c2]]);
    expect(u).toHaveLength(1);
    const a = shapeArea([c]);
    expect(shapeArea(u)).toBeGreaterThan(a);
    expect(shapeArea(u)).toBeLessThan(2 * a);
    const bb = bbox(u);
    expect(bb.maxX - bb.minX).toBeCloseTo(30, 1);
  });

  it('behält Löcher und Inseln im Loch', () => {
    const ring: Shape = [sq(0, 0, 30)[0], sq(10, 10, 10)[0]]; // Quadrat mit Loch
    const u = unionShapes([ring, sq(13, 13, 4)]);
    expect(u).toHaveLength(3);
    expect(shapeArea(u)).toBeCloseTo(900 - 100 + 16, 6);
    expect(pointInShape([15, 15], u)).toBe(true);
    expect(pointInShape([11, 11], u)).toBe(false);
  });

  it('füllt ein Loch, wenn eine andere Form es überdeckt', () => {
    const ring: Shape = [sq(0, 0, 30)[0], sq(10, 10, 10)[0]];
    const u = unionShapes([ring, sq(8, 8, 14)]);
    expect(shapeArea(u)).toBeCloseTo(900, 6);
  });

  it('vereint viele überlappende Formen schnell und ohne Fehler', () => {
    const star = baseShape('star')[0].map(([x, y]) => [x * 20, y * 20] as [number, number]);
    const shapes: Shape[] = [];
    for (let i = 0; i < 15; i++) shapes.push([star.map(([x, y]) => [x + i * 6, y + (i % 3) * 3] as [number, number])]);
    const u = unionShapes(shapes);
    expect(u.length).toBeGreaterThanOrEqual(1);
    expect(shapeArea(u)).toBeGreaterThan(shapeArea(shapes[0]));
  });
});

describe('Hilfsfunktionen', () => {
  it('vereinfacht gerade Linien', () => {
    const pts: [number, number][] = Array.from({ length: 20 }, (_, i) => [i, i * 0.001]);
    expect(simplify(pts, 0.1)).toHaveLength(2);
  });

  it('schätzt dünne Stellen', () => {
    expect(featureSize(sq(0, 0, 10))).toBeCloseTo(10, 6);
    expect(featureSize([[[0, 0], [40, 0], [40, 1], [0, 1]]])).toBeLessThan(2.5);
  });
});
