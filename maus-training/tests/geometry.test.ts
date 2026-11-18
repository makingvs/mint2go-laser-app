import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  dist,
  mulberry32,
  nearestOnPolyline,
  nearestOnSegment,
  nearestTarget,
  normAngle,
  placeNonOverlapping,
  pointAlong,
  polylineLength,
  roundedPath,
  shuffle,
} from '../src/geometry';

describe('Linien', () => {
  it('Abstand zu einer Strecke', () => {
    const n = nearestOnSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(n.d).toBeCloseTo(3);
    expect(n.t).toBeCloseTo(0.5);
  });

  it('Punkt hinter dem Ende wird auf das Ende gedrückt', () => {
    const n = nearestOnSegment({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(n.t).toBe(1);
    expect(n.d).toBeCloseTo(10);
  });

  it('entartete Strecke (a = b) rechnet nicht NaN', () => {
    const n = nearestOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(n.d).toBeCloseTo(5);
  });

  it('Weg entlang einer Linie', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(polylineLength(pts)).toBe(20);
    const n = nearestOnPolyline({ x: 12, y: 5 }, pts);
    expect(n.d).toBeCloseTo(2);
    expect(n.along).toBeCloseTo(15);
    expect(pointAlong(pts, 15)).toEqual({ x: 10, y: 5 });
    expect(pointAlong(pts, 999)).toEqual({ x: 10, y: 10 });
  });

  it('gerundete Ecken bleiben nahe an der Ecke und behalten Anfang und Ende', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const r = roundedPath(pts, 30);
    expect(r[0]).toEqual(pts[0]);
    expect(r[r.length - 1]).toEqual(pts[2]);
    // kein Punkt liegt weiter als der Radius von der Ecke entfernt (außer Anfang/Ende)
    const corner = pts[1];
    const nearest = Math.min(...r.map((p) => dist(p, corner)));
    expect(nearest).toBeGreaterThan(5);
    expect(nearest).toBeLessThan(30);
  });
});

describe('Winkel', () => {
  it('normalisiert und vergleicht über die 0-Grad-Grenze', () => {
    expect(normAngle(-90)).toBe(270);
    expect(normAngle(450)).toBe(90);
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
  });
});

describe('Zufall und Verteilen', () => {
  it('gleicher Startwert = gleiche Folge', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('Mischen verliert nichts', () => {
    const s = shuffle(mulberry32(1), [1, 2, 3, 4, 5, 6]);
    expect(s.slice().sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('platziert alle Kreise ohne Überlappung innerhalb der Fläche', () => {
    const area = { x: 30, y: 110, w: 1220, h: 590 };
    for (let seed = 1; seed <= 20; seed++) {
      const pts = placeNonOverlapping(mulberry32(seed), 16, 50, area, 12);
      expect(pts).toHaveLength(16);
      for (const p of pts) {
        expect(p.x - 50).toBeGreaterThanOrEqual(area.x);
        expect(p.x + 50).toBeLessThanOrEqual(area.x + area.w);
        expect(p.y - 50).toBeGreaterThanOrEqual(area.y);
        expect(p.y + 50).toBeLessThanOrEqual(area.y + area.h);
      }
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) expect(dist(pts[i], pts[j])).toBeGreaterThanOrEqual(100);
    }
  });

  it('meidet Sperrkreise', () => {
    const area = { x: 0, y: 0, w: 400, h: 400 };
    const avoid = [{ x: 200, y: 200, r: 100 }];
    const pts = placeNonOverlapping(mulberry32(3), 4, 30, area, 10, avoid);
    for (const p of pts) expect(dist(p, avoid[0])).toBeGreaterThanOrEqual(130);
  });

  it('liefert auch bei zu dichter Belegung immer n Punkte (kein Endlos-Loop)', () => {
    const pts = placeNonOverlapping(mulberry32(5), 30, 60, { x: 0, y: 0, w: 200, h: 200 }, 12);
    expect(pts).toHaveLength(30);
  });

  it('nächstes Ziel', () => {
    const t = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(nearestTarget({ x: 90, y: 0 }, t, 30)).toBe(1);
    expect(nearestTarget({ x: 50, y: 300 }, t, 30)).toBe(-1);
  });
});
