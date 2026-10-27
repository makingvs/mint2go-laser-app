import { describe, expect, it } from 'vitest';
import { MAX_PITCH, MIN_DIST, MIN_PITCH, cameraPosition, defaultOrbit, fitDistance, maxDist, orbitPan, orbitRotate, orbitZoom } from '../app3d/src/orbit';

const bed = { width: 200, depth: 200, height: 200 };

describe('Kamera um das Druckbett', () => {
  it('Startansicht: Kamera schräg von vorn über dem Bett', () => {
    const o = defaultOrbit(bed);
    const [x, y, z] = cameraPosition(o);
    expect(y).toBeLessThan(0); // vor dem Bett
    expect(z).toBeGreaterThan(0); // darüber
    expect(Math.hypot(x - o.target[0], y - o.target[1], z - o.target[2])).toBeCloseTo(o.dist, 6);
    expect(o.dist).toBeCloseTo(fitDistance(bed), 6);
  });

  it('Position bei Blick von vorn in der Höhe 0', () => {
    const [x, y, z] = cameraPosition({ yaw: -Math.PI / 2, pitch: 0, dist: 100, target: [0, 0, 0] });
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(-100, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('Drehen: nach rechts ziehen dreht die Ansicht, der Höhenwinkel bleibt begrenzt', () => {
    const o = defaultOrbit(bed);
    expect(orbitRotate(o, 50, 0).yaw).toBeLessThan(o.yaw);
    expect(orbitRotate(o, 0, 100000).pitch).toBe(MAX_PITCH);
    expect(orbitRotate(o, 0, -100000).pitch).toBe(MIN_PITCH);
  });

  it('Zoomen: näher heran, aber nie unter das Minimum oder über das Maximum', () => {
    const o = defaultOrbit(bed);
    expect(orbitZoom(o, 2, bed).dist).toBeCloseTo(o.dist / 2, 6);
    expect(orbitZoom(o, 1e9, bed).dist).toBe(MIN_DIST);
    expect(orbitZoom(o, 1e-9, bed).dist).toBe(maxDist(bed));
    expect(orbitZoom(o, 0, bed)).toBe(o);
    expect(orbitZoom(o, NaN, bed)).toBe(o);
  });

  it('Verschieben: der Inhalt folgt dem Finger und bleibt im Bett', () => {
    const o = { yaw: -Math.PI / 2, pitch: 0.6, dist: 300, target: [0, 0, 0] as [number, number, number] };
    // Blick von vorn: Finger nach rechts -> Inhalt nach rechts -> Ziel nach links (-x)
    expect(orbitPan(o, 100, 0, 800, bed).target[0]).toBeLessThan(0);
    // Finger nach unten -> Inhalt zur Kamera hin (-y) -> Ziel nach hinten (+y)
    expect(orbitPan(o, 0, 100, 800, bed).target[1]).toBeGreaterThan(0);
    const far = orbitPan(o, 1e6, 1e6, 800, bed).target;
    expect(Math.abs(far[0])).toBeLessThanOrEqual(100);
    expect(Math.abs(far[1])).toBeLessThanOrEqual(100);
    expect(orbitPan(o, 10, 10, 0, bed)).toBe(o);
  });
});
