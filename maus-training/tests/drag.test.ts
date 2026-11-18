import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/geometry';
import { binCell, hitTarget, resolveDrop, rowSpots, type DropTarget } from '../src/games/dragLogic';
import { isUpright, startAngle, STEP } from '../src/games/rotate';

const bins: DropTarget[] = [
  { x: 200, y: 600, w: 300, h: 180, shape: 'rect', kind: 'circle' },
  { x: 640, y: 600, w: 300, h: 180, shape: 'rect', kind: 'square' },
];
const holes: DropTarget[] = [
  { x: 700, y: 250, w: 130, h: 130, shape: 'circle', kind: 'star' },
  { x: 900, y: 250, w: 130, h: 130, shape: 'circle', kind: 'heart' },
];

describe('Ablegen', () => {
  it('richtiger Korb = ok, falscher = wrong, daneben = none', () => {
    expect(resolveDrop({ x: 210, y: 590 }, { kind: 'circle', rot: 0 }, bins)).toEqual({ type: 'ok', target: 0 });
    expect(resolveDrop({ x: 640, y: 600 }, { kind: 'circle', rot: 0 }, bins)).toEqual({ type: 'wrong', target: 1 });
    expect(resolveDrop({ x: 400, y: 200 }, { kind: 'circle', rot: 0 }, bins)).toEqual({ type: 'none' });
  });

  it('Loch: etwas daneben zählt noch, weit weg nicht', () => {
    expect(hitTarget({ x: 700 + 65 + 30, y: 250 }, [holes[0]])).toBe(0);
    expect(hitTarget({ x: 700 + 65 + 60, y: 250 }, [holes[0]])).toBe(-1);
  });

  it('zwischen zwei Löchern gewinnt das nähere', () => {
    expect(hitTarget({ x: 840, y: 250 }, holes)).toBe(1);
    expect(hitTarget({ x: 760, y: 250 }, holes)).toBe(0);
  });

  it('richtiges Loch ok, falsches wrong', () => {
    expect(resolveDrop({ x: 705, y: 255 }, { kind: 'star', rot: 0 }, holes)).toEqual({ type: 'ok', target: 0 });
    expect(resolveDrop({ x: 705, y: 255 }, { kind: 'heart', rot: 0 }, holes)).toEqual({ type: 'wrong', target: 0 });
  });

  it('Drehaufgabe: richtiges Loch, aber falsch gedreht = needsTurn', () => {
    const slots: DropTarget[] = [{ x: 800, y: 270, w: 170, h: 170, shape: 'circle', kind: 'house', rot: 180 }];
    expect(resolveDrop({ x: 800, y: 270 }, { kind: 'house', rot: 90 }, slots)).toEqual({ type: 'needsTurn', target: 0 });
    expect(resolveDrop({ x: 800, y: 270 }, { kind: 'house', rot: 180 }, slots)).toEqual({ type: 'ok', target: 0 });
    // mitgezählte Winkel über 360 und im Minus zählen richtig
    expect(resolveDrop({ x: 800, y: 270 }, { kind: 'house', rot: 540 }, slots).type).toBe('ok');
    expect(resolveDrop({ x: 800, y: 270 }, { kind: 'house', rot: -180 }, slots).type).toBe('ok');
    // falsche Art vor falscher Drehung
    expect(resolveDrop({ x: 800, y: 270 }, { kind: 'tree', rot: 0 }, slots).type).toBe('wrong');
  });

  it('Plätze und Korbzellen liegen in der Fläche', () => {
    const spots = rowSpots(5, 100, 1200, 250, 30, mulberry32(1));
    expect(spots).toHaveLength(5);
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(100);
      expect(s.x).toBeLessThan(1200);
      expect(Math.abs(s.y - 250)).toBeLessThanOrEqual(30);
    }
    expect(binCell(300, 600, 0).x).toBeLessThan(binCell(300, 600, 2).x);
    expect(binCell(300, 600, 3).y).toBeGreaterThan(binCell(300, 600, 0).y);
  });
});

describe('Drehen', () => {
  it('Startwinkel ist nie gerade; Rad mindestens 30 Grad daneben und in 15er-Schritten', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 200; i++) {
      const c = startAngle(rng, 'click');
      expect([90, 180, 270]).toContain(c);
      const w = startAngle(rng, 'wheel');
      expect(w % STEP.wheel).toBe(0);
      expect(w).toBeGreaterThanOrEqual(30);
      expect(w).toBeLessThanOrEqual(330);
    }
  });

  it('gerade nach passender Zahl Schritte, auch über mehrere Umdrehungen und rückwärts', () => {
    expect(isUpright(270 + 90)).toBe(true);
    expect(isUpright(30 - 2 * 15)).toBe(true);
    expect(isUpright(-360)).toBe(true);
    expect(isUpright(45)).toBe(false);
  });

  it('jedes Startwinkel ist mit Schritten erreichbar', () => {
    for (let a = 30; a <= 330; a += 15) expect((360 - a) % STEP.wheel).toBe(0);
    for (const a of [90, 180, 270]) expect((360 - a) % STEP.click).toBe(0);
  });
});
