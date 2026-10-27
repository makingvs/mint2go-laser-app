import { describe, expect, it } from 'vitest';
import { History } from '../app3d/src/history';
import { PART_KINDS } from '../app3d/src/mesh';
import { MAX_SIZE, MIN_SIZE, applyDim, createPart, duplicatePart, findFreeSpot, isOutside, makeOutlinePart, normalizeRot, partBounds, snap } from '../app3d/src/model3d';

const bed = { width: 200, depth: 200, height: 100 };

describe('Körper', () => {
  it('neue Körper liegen auf dem Bett und haben die Startgröße', () => {
    for (const kind of PART_KINDS) {
      const b = partBounds(createPart(kind));
      expect(b.min[2]).toBeCloseTo(0, 9);
      expect(b.max[2]).toBeGreaterThan(5);
    }
  });

  it('Grenzen: Drehen um 90° vertauscht Breite und Tiefe, Verschieben und Abstand zum Bett', () => {
    const p = { ...createPart('box'), w: 40, d: 20, h: 10, x: 5, y: -5, z: 3 };
    let b = partBounds(p);
    expect(b.min[0]).toBeCloseTo(-15, 6);
    expect(b.max[0]).toBeCloseTo(25, 6);
    expect(b.min[1]).toBeCloseTo(-15, 6);
    expect(b.max[1]).toBeCloseTo(5, 6);
    expect(b.min[2]).toBeCloseTo(3, 6);
    expect(b.max[2]).toBeCloseTo(13, 6);
    b = partBounds({ ...p, rot: 90 });
    expect(b.min[0]).toBeCloseTo(-5, 6);
    expect(b.max[0]).toBeCloseTo(15, 6);
    expect(b.min[1]).toBeCloseTo(-25, 6);
    expect(b.max[1]).toBeCloseTo(15, 6);
  });

  it('erkennt Körper außerhalb des Bauraums', () => {
    const p = createPart('box');
    expect(isOutside(p, bed)).toBe(false);
    expect(isOutside({ ...p, x: 95 }, bed)).toBe(true); // 95 + 15 > 100
    expect(isOutside({ ...p, h: 120 }, bed)).toBe(true);
    expect(isOutside({ ...p, z: -1 }, bed)).toBe(true);
  });

  it('Maße ändern: einzeln, mit Schloss gemeinsam, immer begrenzt', () => {
    const p = { ...createPart('box'), w: 20, d: 10, h: 40 };
    expect(applyDim(p, 'w', 30, false, bed)).toMatchObject({ w: 30, d: 10, h: 40 });
    expect(applyDim(p, 'w', 40, true, bed)).toMatchObject({ w: 40, d: 20, h: 80 });
    expect(applyDim(p, 'h', 1, false, bed).h).toBe(MIN_SIZE);
    expect(applyDim(p, 'h', 9999, false, bed).h).toBe(MAX_SIZE);
    // mit Schloss: das kleinste Maß (d = 10) darf nicht unter das Minimum fallen
    const small = applyDim(p, 'w', 0.5, true, bed);
    expect(Math.min(small.w, small.d, small.h)).toBeCloseTo(MIN_SIZE, 6);
    expect(small.w / small.d).toBeCloseTo(2, 1);
    expect(applyDim(p, 'rot', -90, false, bed).rot).toBe(270);
    expect(applyDim(p, 'z', 500, false, bed).z).toBeLessThan(bed.height);
    expect(applyDim(p, 'z', -5, false, bed).z).toBe(0);
  });

  it('Drehwinkel wird in 0..<360 gebracht', () => {
    expect(normalizeRot(360)).toBe(0);
    expect(normalizeRot(-30)).toBe(330);
    expect(normalizeRot(725)).toBe(5);
    expect(normalizeRot(359.97)).toBe(0);
  });

  it('einrasten auf ganze mm', () => {
    expect(snap(12.4)).toBe(12);
    expect(snap(12.6)).toBe(13);
    expect(snap(12.4, 5)).toBe(10);
  });

  it('neuer Körper bekommt freien Platz, möglichst in der Mitte', () => {
    expect(findFreeSpot('box', [], bed)).toEqual({ x: 0, y: 0 });
    const first = createPart('box', 0, 0);
    const spot = findFreeSpot('box', [first], bed);
    const second = { ...createPart('box'), ...spot };
    const a = partBounds(first);
    const b = partBounds(second);
    const overlap = a.max[0] > b.min[0] && a.min[0] < b.max[0] && a.max[1] > b.min[1] && a.min[1] < b.max[1];
    expect(overlap).toBe(false);
    expect(isOutside(second, bed)).toBe(false);
  });

  it('Kopie hat neue Nummer und ist versetzt', () => {
    const p = createPart('cone', 10, 10);
    const c = duplicatePart(p);
    expect(c.id).not.toBe(p.id);
    expect(c.kind).toBe('cone');
    expect(c.x).not.toBe(p.x);
  });
});

describe('Rückgängig', () => {
  it('Schnappschüsse: zurück, vor, neue Änderung verwirft "vor"', () => {
    const h = new History<number[]>([1]);
    expect(h.commit([1])).toBe(false);
    expect(h.commit([1, 2])).toBe(true);
    expect(h.commit([1, 2, 3])).toBe(true);
    expect(h.canUndo).toBe(true);
    expect(h.undo()).toEqual([1, 2]);
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toEqual([1, 2, 3]);
    expect(h.undo()).toEqual([1, 2]);
    h.commit([9]);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toEqual([1, 2]);
    expect(h.undo()).toEqual([1]);
    expect(h.undo()).toBeNull();
  });
});

describe('Gezeichnete Körper (Umriss mit Höhe)', () => {
  const bed2 = { width: 200, depth: 200, height: 100 };
  const rect = (w: number, h: number): [number, number][] => [[0, 0], [w, 0], [w, h], [0, h]];

  it('längste Seite wird auf die gewünschte Länge gebracht, die Höhe stimmt', () => {
    const p = makeOutlinePart([rect(20, 10)], { longest: 40 }, 8, bed2)!;
    expect(p.kind).toBe('extrude');
    expect([p.w, p.d, p.h]).toEqual([40, 20, 8]);
    const b = partBounds(p);
    expect(b.min[2]).toBe(0);
    expect(b.max[2]).toBeCloseTo(8, 9);
    expect(b.max[0] - b.min[0]).toBeCloseTo(40, 6);
    expect(b.max[1] - b.min[1]).toBeCloseTo(20, 6);
  });

  it('Maßstab statt Länge (Text)', () => {
    const p = makeOutlinePart([rect(20, 10)], { scale: 2 }, 5, bed2)!;
    expect([p.w, p.d]).toEqual([40, 20]);
  });

  it('wird aufs Bett begrenzt und nicht unter das Mindestmaß gedrückt', () => {
    const big = makeOutlinePart([rect(20, 10)], { longest: 5000 }, 8, bed2)!;
    expect(big.w).toBeLessThanOrEqual(180);
    const tiny = makeOutlinePart([rect(20, 10)], { longest: 0.1 }, 8, bed2)!;
    expect(Math.min(tiny.w, tiny.d)).toBeGreaterThanOrEqual(MIN_SIZE);
  });

  it('Höhe wird begrenzt, leere Form ergibt nichts', () => {
    expect(makeOutlinePart([rect(20, 10)], { longest: 40 }, 5000, bed2)!.h).toBe(100);
    expect(makeOutlinePart([rect(20, 10)], { longest: 40 }, 0, bed2)!.h).toBe(MIN_SIZE);
    expect(makeOutlinePart([], { longest: 40 }, 8, bed2)).toBeNull();
  });

  it('Maße, Drehen und freier Platz funktionieren auch für gezeichnete Körper', () => {
    const a = makeOutlinePart([rect(20, 10)], { longest: 40 }, 8, bed2)!;
    expect(applyDim(a, 'h', 20, false, bed2).h).toBe(20);
    const spot = findFreeSpot(a, [{ ...a, x: 0, y: 0 }], bed2);
    const b = { ...a, ...spot };
    const ba = partBounds({ ...a, x: 0, y: 0 });
    const bb = partBounds(b);
    expect(ba.max[0] > bb.min[0] && ba.min[0] < bb.max[0] && ba.max[1] > bb.min[1] && ba.min[1] < bb.max[1]).toBe(false);
    expect(isOutside(b, bed2)).toBe(false);
  });
});
