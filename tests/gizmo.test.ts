import { describe, expect, it } from 'vitest';
import { closestZOnVertical, rayPlaneZ, resizeFromGround, resizeHeight, rotateFromGround, toLocal } from '../app3d/src/gizmo';
import { MIN_SIZE, createPart } from '../app3d/src/model3d';

const box = { ...createPart('box'), w: 20, d: 10, h: 30, x: 10, y: 20 };

describe('Griffe: Strahlen', () => {
  it('Strahl trifft die Ebene z = 5', () => {
    const hit = rayPlaneZ([0, -100, 105], [0, 1, -1], 5);
    expect(hit![0]).toBeCloseTo(0, 9);
    expect(hit![1]).toBeCloseTo(0, 9);
  });
  it('kein Treffer, wenn parallel oder die Ebene hinter der Kamera liegt', () => {
    expect(rayPlaneZ([0, 0, 10], [1, 0, 0], 0)).toBeNull();
    expect(rayPlaneZ([0, 0, 10], [0, 0, 1], 0)).toBeNull();
  });
  it('nächster Punkt auf der senkrechten Linie', () => {
    // Strahl von (100, 0, 50) in Richtung -x trifft die Linie bei x = 0 genau in der Höhe 50
    expect(closestZOnVertical([100, 0, 50], [-1, 0, 0], 0, 0)).toBeCloseTo(50, 9);
    // schräg von oben: Strahl von (100, 0, 150) Richtung (-1, 0, -1) kreuzt x = 0 bei z = 50
    expect(closestZOnVertical([100, 0, 150], [-1, 0, -1], 0, 0)).toBeCloseTo(50, 9);
    expect(closestZOnVertical([0, 0, 50], [0, 0, 1], 0, 0)).toBeNull(); // parallel zur Linie
  });
});

describe('Griffe: Größe, Höhe, Drehen', () => {
  it('toLocal berücksichtigt Mitte und Drehung', () => {
    const [lx, ly] = toLocal({ x: 10, y: 20, rot: 90 }, 10, 30); // 10 mm "vor" der Mitte in y
    expect(lx).toBeCloseTo(10, 9);
    expect(ly).toBeCloseTo(0, 9);
  });

  it('Ecken-Griff ohne Schloss: Breite und Tiefe wachsen um das Doppelte der Bewegung', () => {
    const r = resizeFromGround(box, [20, 25], [25, 30], false);
    expect(r.w).toBeCloseTo(30, 9);
    expect(r.d).toBeCloseTo(20, 9);
    expect(r.h).toBe(30);
    expect([r.x, r.y]).toEqual([10, 20]);
  });

  it('Ecken-Griff mit Schloss: alles wächst im gleichen Verhältnis', () => {
    const r = resizeFromGround(box, [20, 25], [30, 30], true); // w: 20->40 (2.0x), d: 10->20 (2.0x)
    expect(r.w / box.w).toBeCloseTo(r.h / box.h, 9);
    expect(r.d / box.d).toBeCloseTo(r.h / box.h, 9);
    expect(r.w).toBeCloseTo(40, 9);
  });

  it('Ecken-Griff: nie kleiner als das Mindestmaß', () => {
    const r = resizeFromGround(box, [20, 25], [-500, -500], false);
    expect(r.w).toBe(MIN_SIZE);
    expect(r.d).toBe(MIN_SIZE);
    const l = resizeFromGround(box, [20, 25], [-500, -500], true);
    expect(Math.min(l.w, l.d, l.h)).toBeCloseTo(MIN_SIZE, 6);
  });

  it('Höhen-Griff', () => {
    expect(resizeHeight(box, 10, false)).toMatchObject({ w: 20, d: 10, h: 40 });
    const l = resizeHeight(box, 30, true); // h 30 -> 60 = 2x
    expect(l).toMatchObject({ w: 40, d: 20, h: 60 });
    expect(resizeHeight(box, -1000, false).h).toBe(MIN_SIZE);
  });

  it('Dreh-Griff folgt dem Finger und rastet auf 5° ein', () => {
    // Finger startet rechts von der Mitte (Winkel 0) und geht nach oben (Winkel 90°)
    const r = rotateFromGround(box, [30, 20], [10, 40], 5);
    expect(r.rot).toBe(90);
    const s = rotateFromGround(box, [30, 20], [10 + 20 * Math.cos(0.3), 20 + 20 * Math.sin(0.3)], 5);
    expect(s.rot % 5).toBe(0);
    // Gegen den Uhrzeigersinn über 360° hinaus wird in 0..<360 gebracht
    const t = rotateFromGround({ ...box, rot: 350 }, [30, 20], [10, 40], 5);
    expect(t.rot).toBe(80);
  });
});
