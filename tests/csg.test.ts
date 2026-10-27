import { describe, expect, it } from 'vitest';
import { textShape } from '../src/text';
import { combine } from '../app3d/src/csg';
import { meshVolume } from '../app3d/src/mesh';
import { createPart, makeOutlinePart, meshOf, partBounds, type Part } from '../app3d/src/model3d';

const box = (x: number, y: number, z: number, s = 30): Part => ({ ...createPart('box', x, y), z, w: s, d: s, h: s });
const hole = (p: Part): Part => ({ ...p, hole: true });
/** Rauminhalt eines Körpers in mm³ (Netz im Einheitsquader mal Maße) */
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

describe('Kombinieren (manifold)', () => {
  it('zwei überlappende Würfel werden vereint (Rauminhalt ohne die doppelte Mitte)', async () => {
    const a = box(0, 0, 0);
    const b = box(20, 0, 0);
    const r = await combine(a.id, [a, b]);
    if (r.kind !== 'ok' || !r.part) throw new Error('kein Ergebnis');
    expect(new Set(r.ids)).toEqual(new Set([a.id, b.id]));
    expect(r.part.kind).toBe('mesh');
    expect(volume(r.part)).toBeCloseTo(2 * 27000 - 10 * 30 * 30, 0);
    expect([r.part.w, r.part.d, r.part.h]).toEqual([50, 30, 30]);
    expect(r.part.x).toBeCloseTo(10, 3);
    expect(r.part.z).toBe(0);
    expect(edgeProblems(r.part)).toEqual([]);
  });

  it('bündige Flächen (Würfel auf Würfel) werden verbunden', async () => {
    const a = box(0, 0, 0);
    const b = box(0, 0, 30);
    const r = await combine(b.id, [a, b]);
    if (r.kind !== 'ok' || !r.part) throw new Error('kein Ergebnis');
    expect(volume(r.part)).toBeCloseTo(54000, 0);
    expect(r.part.h).toBe(60);
    expect(edgeProblems(r.part)).toEqual([]);
  });

  it('Loch schneidet aus (Zylinder durch eine Platte)', async () => {
    const plate = { ...box(0, 0, 0, 40), h: 20 };
    const bore = hole({ ...createPart('cylinder', 0, 0), z: -5, w: 20, d: 20, h: 30 });
    const r = await combine(plate.id, [plate, bore]);
    if (r.kind !== 'ok' || !r.part) throw new Error('kein Ergebnis');
    const cyl = 0.5 * 48 * 100 * Math.sin((2 * Math.PI) / 48) * 20; // 48-Eck, Höhe 20 in der Platte
    expect(volume(r.part)).toBeCloseTo(32000 - cyl, 0);
    expect(r.part.hole).toBeUndefined();
    expect(edgeProblems(r.part)).toEqual([]);
    // Genus 1: Loch geht durch -> Netz hat 2 Randringe mehr; hier reicht: Quader bleibt 40 x 40 x 20
    expect([r.part.w, r.part.d, r.part.h]).toEqual([40, 40, 20]);
  });

  it('auch das Loch kann gewählt sein', async () => {
    const plate = { ...box(0, 0, 0, 40), h: 20 };
    const bore = hole({ ...createPart('cylinder', 0, 0), z: -5, w: 20, d: 20, h: 30 });
    const r = await combine(bore.id, [plate, bore]);
    expect(r.kind).toBe('ok');
  });

  it('Kette: A berührt B, B berührt C -> alle drei werden vereint', async () => {
    const a = box(0, 0, 0, 20);
    const b = box(20, 0, 0, 20); // berührt A seitlich
    const c = box(40, 0, 0, 20); // berührt nur B
    const r = await combine(a.id, [a, b, c]);
    if (r.kind !== 'ok' || !r.part) throw new Error('kein Ergebnis');
    expect(r.ids).toHaveLength(3);
    expect(volume(r.part)).toBeCloseTo(3 * 8000, 0);
  });

  it('nicht berührende Körper bleiben unberührt', async () => {
    const a = box(0, 0, 0);
    const far = box(100, 0, 0);
    const r = await combine(a.id, [a, far]);
    expect(r.kind).toBe('none');
    const touching = box(25, 0, 0);
    const r2 = await combine(a.id, [a, far, touching]);
    if (r2.kind !== 'ok') throw new Error('kein Ergebnis');
    expect(new Set(r2.ids)).toEqual(new Set([a.id, touching.id])); // far bleibt draußen
  });

  it('Kugel im Loch eines Rings (Umgebungsquader überlappen, aber keine Berührung) wird nicht vereint', async () => {
    const ring = { ...createPart('ring', 0, 0), w: 40, d: 40, h: 10 };
    const ball = { ...createPart('sphere', 0, 0), w: 10, d: 10, h: 10 };
    expect((await combine(ring.id, [ring, ball])).kind).toBe('none');
  });

  it('allein oder nur Löcher: nichts zu tun', async () => {
    const a = box(0, 0, 0);
    expect((await combine(a.id, [a])).kind).toBe('none');
    const h1 = hole(box(0, 0, 0));
    const h2 = hole(box(10, 0, 0));
    expect((await combine(h1.id, [h1, h2])).kind).toBe('none');
  });

  it('Loch, das alles wegschneidet: nichts bleibt übrig', async () => {
    const a = box(0, 0, 0, 20);
    const big = hole(box(0, 0, -5, 60));
    const r = await combine(a.id, [a, big]);
    expect(r).toEqual({ kind: 'ok', ids: expect.arrayContaining([a.id, big.id]), part: null });
  });

  it('gezeichneter Text auf einer Platte (eigene Extrusion) lässt sich vereinen', async () => {
    const bed = { width: 220, depth: 220, height: 250 };
    const text = makeOutlinePart(textShape('HALLO 08'), { scale: 2 }, 4, bed, 0, 0)!;
    const plate = { ...createPart('box', 0, 0), z: -3, w: text.w + 10, d: text.d + 10, h: 3 }; // Platte unter dem Text, bündig
    const r = await combine(text.id, [text, plate]);
    if (r.kind !== 'ok' || !r.part) throw new Error('kein Ergebnis: ' + r.kind);
    expect(edgeProblems(r.part)).toEqual([]);
    expect(volume(r.part)).toBeCloseTo(volume(text) + volume(plate), -1);
    const b = partBounds(r.part);
    expect(b.max[2] - b.min[2]).toBeCloseTo(7, 3);
  });

  it('Netz des Ergebnisses liegt im Einheitsquader', async () => {
    const r = await combine('a', [box(0, 0, 0), box(10, 10, 10)].map((p, i) => ({ ...p, id: i === 0 ? 'a' : 'b' })));
    if (r.kind !== 'ok' || !r.part) throw new Error('kein Ergebnis');
    const m = meshOf(r.part);
    for (let i = 0; i < m.pos.length; i += 3) {
      expect(Math.abs(m.pos[i])).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(m.pos[i + 1])).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(m.pos[i + 2]).toBeGreaterThanOrEqual(-1e-9);
      expect(m.pos[i + 2]).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
