import { describe, expect, it } from 'vitest';
import { signedArea, type Shape } from '../src/geometry';
import { extrudeMesh } from '../app3d/src/extrude';
import { meshVolume } from '../app3d/src/mesh';
import { GEAR_MODULE, MAX_TEETH, MIN_TEETH, gearShape, pitchDiameter, tubeShape } from '../app3d/src/shapes3d';
import { createPart, makeGearPart, makeOutlinePart, makeTubePart, meshOf, partBounds, type Part } from '../app3d/src/model3d';
import { alignCenter, copyOffset, mirrorPart, tiltPart } from '../app3d/src/transform';

const bed = { width: 220, depth: 220, height: 250 };
const box = (x: number, y: number, z: number, w: number, d: number, h: number): Part => ({ ...createPart('box', x, y), z, w, d, h });
const volume = (p: Part): number => meshVolume(meshOf(p)) * p.w * p.d * p.h;

function edgeProblems(p: Part): string[] {
  const m = meshOf(p);
  const seen = new Map<string, number>();
  for (let t = 0; t < m.idx.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const key = `${m.idx[t + k]}>${m.idx[t + ((k + 1) % 3)]}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  const bad: string[] = [];
  for (const [e, n] of seen) {
    const [a, b] = e.split('>');
    if (n !== 1) bad.push(`doppelt ${e}`);
    if (seen.get(`${b}>${a}`) !== 1) bad.push(`offen ${e}`);
  }
  return bad;
}

describe('Kippen', () => {
  it('90° um die x-Achse vertauscht Tiefe und Höhe, der Boden bleibt auf der Auflage', () => {
    const p = box(10, 20, 5, 20, 30, 40);
    const t = tiltPart(p, 'x', 90);
    expect(t.kind).toBe('mesh');
    expect([t.w, t.d, t.h]).toEqual([20, 40, 30]);
    expect(t.z).toBe(5);
    expect(partBounds(t).min[2]).toBeCloseTo(5, 3);
    expect([t.x, t.y]).toEqual([10, 20]);
    expect(volume(t)).toBeCloseTo(20 * 30 * 40, 0);
    expect(edgeProblems(t)).toEqual([]);
    expect(t.tilt).toEqual({ x: 90, y: 0 });
  });

  it('90° um die y-Achse vertauscht Breite und Höhe; Kippen zählt zusammen (4 x 90° = zurück)', () => {
    let p = box(0, 0, 0, 20, 30, 40);
    p = tiltPart(p, 'y', 90);
    expect([p.w, p.d, p.h]).toEqual([40, 30, 20]);
    expect(p.tilt).toEqual({ x: 0, y: 90 });
    for (let i = 0; i < 3; i++) p = tiltPart(p, 'y', 90);
    expect([p.w, p.d, p.h]).toEqual([20, 30, 40]);
    expect(p.tilt).toEqual({ x: 0, y: 0 });
  });

  it('Kegel 180° gekippt: Spitze zeigt nach unten (Volumen gleich, geschlossen)', () => {
    const cone = { ...createPart('cone', 0, 0), w: 20, d: 20, h: 20 };
    const t = tiltPart(tiltPart(cone, 'x', 90), 'x', 90);
    expect(t.tilt).toEqual({ x: 180, y: 0 });
    expect(volume(t)).toBeCloseTo(volume(cone), 0);
    expect(edgeProblems(t)).toEqual([]);
    // unten (z-Anteil 0) liegt nur die Spitze: dort liegen alle Eckpunkte in der Mitte
    const m = meshOf(t);
    const lowest: number[][] = [];
    for (let i = 0; i < m.pos.length; i += 3) if (m.pos[i + 2] < 0.01) lowest.push([m.pos[i], m.pos[i + 1]]);
    expect(lowest.length).toBeGreaterThan(0);
    expect(lowest.every(([x, y]) => Math.hypot(x, y) < 0.01)).toBe(true);
  });

  it('beliebiger Winkel: 20° um x ergibt die erwartete Tiefe und Höhe', () => {
    const t = tiltPart(box(0, 0, 0, 80, 6, 60), 'x', 20);
    const a = (20 * Math.PI) / 180;
    expect(t.d).toBeCloseTo(6 * Math.cos(a) + 60 * Math.sin(a), 1);
    expect(t.h).toBeCloseTo(60 * Math.cos(a) + 6 * Math.sin(a), 1);
    expect(t.w).toBe(80);
    expect(t.tilt!.x).toBe(20);
  });

  it('behält Loch-Eigenschaft und Herkunft; gezeichnete Körper werden zum Netz', () => {
    const tube = { ...makeTubePart(bed, 24, 60), hole: true };
    const t = tiltPart(tube, 'y', 90);
    expect(t.hole).toBe(true);
    expect(t.tag).toBe('tube');
    expect(t.outline).toBeUndefined();
    expect(t.w).toBeCloseTo(60, 1);
    expect(t.h).toBeCloseTo(24, 1);
    expect(edgeProblems(t)).toEqual([]);
  });
});

describe('Spiegeln', () => {
  const L: Shape = [[[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]]]; // L-Form (y nach unten)
  it('gezeichneter Umriss wird gespiegelt: gleiche Maße, andere Lage der Ecke, geschlossen', () => {
    const p = makeOutlinePart(L, { longest: 30 }, 5, bed)!;
    const m = mirrorPart(p);
    expect([m.w, m.d, m.h]).toEqual([p.w, p.d, p.h]);
    expect(m.id).toBe(p.id);
    expect(m.outline!.id).not.toBe(p.outline!.id);
    const cx = (s: Shape): number => s.reduce((a, r) => a + r.reduce((q, [x]) => q + x, 0) / r.length, 0);
    expect(Math.sign(cx(m.outline!.rings))).toBe(-Math.sign(cx(p.outline!.rings)));
    for (const r of m.outline!.rings) expect(signedArea(r)).toBeGreaterThan(0); // Außenring bleibt gegen den Uhrzeigersinn
    expect(volume(m)).toBeCloseTo(volume(p), 2);
    expect(edgeProblems(m)).toEqual([]);
    expect(mirrorPart(mirrorPart(p)).outline!.rings).toEqual(p.outline!.rings);
    expect(meshVolume(extrudeMesh(m.outline!.rings))).toBeCloseTo(meshVolume(extrudeMesh(p.outline!.rings)), 6);
  });

  it('gekipptes Netz wird gespiegelt, Dreiecke bleiben nach außen gerichtet', () => {
    const t = tiltPart(box(0, 0, 0, 20, 30, 40), 'y', 30);
    const m = mirrorPart(t);
    expect(m.meshId).not.toBe(t.meshId);
    expect(volume(m)).toBeGreaterThan(0);
    expect(volume(m)).toBeCloseTo(volume(t), 1);
    expect(edgeProblems(m)).toEqual([]);
  });

  it('symmetrische Grundkörper bleiben unverändert', () => {
    const b = box(0, 0, 0, 10, 10, 10);
    expect(mirrorPart(b)).toBe(b);
  });
});

describe('Ausrichten', () => {
  it('Mitte auf Mitte mit dem Körper, der am meisten überlappt', () => {
    const plate = box(10, 20, 0, 80, 40, 3);
    const small = box(25, 12, 3, 20, 10, 5);
    const r = alignCenter(small, [plate, small])!;
    expect([r.x, r.y]).toEqual([10, 20]);
    expect(r.z).toBe(3);
  });

  it('wählt den größeren Überlapp; Löcher und weit entfernte Körper zählen nicht', () => {
    const p = box(0, 0, 0, 20, 20, 5);
    const big = box(15, 0, 0, 40, 20, 5); // Überlapp 25 x 20
    const small = box(-12, 0, 0, 10, 20, 5); // Überlapp 3 x 20
    const r = alignCenter(p, [small, big])!;
    expect([r.x, r.y]).toEqual([15, 0]);
    expect(alignCenter(p, [box(100, 0, 0, 10, 10, 5)])).toBeNull();
    expect(alignCenter(p, [{ ...box(0, 0, 0, 30, 30, 5), hole: true }])).toBeNull();
  });
});

describe('Kopie merkt den Abstand', () => {
  it('ohne Vorlage fester Versatz, mit Vorlage der gleiche Schritt wie zuletzt', () => {
    const a = box(0, 0, 0, 10, 10, 10);
    expect(copyOffset(a, undefined)).toEqual([15, -15, 0]);
    const b = { ...a, x: 12, y: 3, z: 0 };
    expect(copyOffset(b, a)).toEqual([12, 3, 0]);
    expect(copyOffset({ ...a, x: 0.2 }, a)).toEqual([15, -15, 0]); // kaum bewegt: fester Versatz
  });
});

describe('Röhre', () => {
  it('Außendurchmesser, Wand ein Sechstel des Radius, geschlossen, hohler Rauminhalt', () => {
    const t = makeTubePart(bed, 24, 60);
    expect([t.w, t.d, t.h, t.tag]).toEqual([24, 24, 60, 'tube']);
    const [outer, inner] = tubeShape(24);
    const ro = Math.max(...outer.map(([x]) => x));
    const ri = Math.max(...inner.map(([x]) => x));
    expect(ro - ri).toBeCloseTo(2, 5);
    const area = (r: [number, number][]): number => Math.abs(signedArea(r));
    expect(volume(t)).toBeCloseTo((area(outer) - area(inner)) * 60, 0);
    expect(edgeProblems(t)).toEqual([]);
  });
});

describe('Zahnrad', () => {
  it('Außendurchmesser = (Zähne + 2) x Modul, Achsloch, geschlossen', () => {
    for (const n of [MIN_TEETH, 10, 16, 20, MAX_TEETH]) {
      const g = makeGearPart(n, 5, bed);
      expect(g.teeth).toBe(n);
      expect(g.tag).toBe('gear');
      expect(g.w).toBeGreaterThan((n + 1.5) * GEAR_MODULE);
      expect(g.w).toBeLessThanOrEqual((n + 2) * GEAR_MODULE + 0.2);
      expect(edgeProblems(g)).toEqual([]);
      expect(g.outline!.rings).toHaveLength(2); // Außenring und Achsloch
    }
  });

  it('Zähnezahl wird begrenzt', () => {
    expect(makeGearPart(2, 5, bed).teeth).toBe(MIN_TEETH);
    expect(makeGearPart(99, 5, bed).teeth).toBe(MAX_TEETH);
  });

  it('zwei Zahnräder greifen: beim Drehen (gegenläufig) überlappen sich die Zähne nie', () => {
    const nA = 10;
    const nB = 20;
    const a = gearShape(nA)[0];
    const b = gearShape(nB)[0];
    const dist = (pitchDiameter(nA) + pitchDiameter(nB)) / 2;
    const rotate = (pts: [number, number][], ang: number, dx: number): [number, number][] =>
      pts.map(([x, y]) => [dx + x * Math.cos(ang) - y * Math.sin(ang), x * Math.sin(ang) + y * Math.cos(ang)] as [number, number]);
    const inside = (pt: [number, number], poly: [number, number][]): boolean => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const pB = (2 * Math.PI) / nB;
    let worst = 0;
    for (let k = 0; k <= 40; k++) {
      const alpha = (k / 40) * ((2 * Math.PI) / nA); // A dreht eine Zahnteilung weiter
      const aa = rotate(a, alpha, 0);
      const bb = rotate(b, Math.PI - 0.5 * pB - (alpha * nA) / nB, dist); // B dreht gegenläufig, Zahn von A zeigt in eine Lücke von B
      worst = Math.max(worst, aa.filter((p) => inside(p, bb)).length + bb.filter((p) => inside(p, aa)).length);
    }
    expect(worst).toBe(0);
  });
});
