import { describe, expect, it } from 'vitest';
import { PART_KINDS, meshVolume, unitMesh, type PartKind } from '../app3d/src/mesh';

const key = (p: number[], i: number): string => `${p[i * 3].toFixed(6)},${p[i * 3 + 1].toFixed(6)},${p[i * 3 + 2].toFixed(6)}`;

/** Geschlossen und sauber orientiert: jede Kante kommt genau einmal in jede Richtung vor. */
function edgeProblems(kind: PartKind): string[] {
  const m = unitMesh(kind);
  const seen = new Map<string, number>();
  for (let t = 0; t < m.idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = key(m.pos, m.idx[t + k]);
      const b = key(m.pos, m.idx[t + ((k + 1) % 3)]);
      seen.set(`${a}>${b}`, (seen.get(`${a}>${b}`) ?? 0) + 1);
    }
  }
  const bad: string[] = [];
  for (const [e, n] of seen) {
    const [a, b] = e.split('>');
    if (n !== 1) bad.push(`doppelt ${e}`);
    if (seen.get(`${b}>${a}`) !== 1) bad.push(`offen ${e}`);
  }
  return bad;
}

describe('Netze der Grundkörper', () => {
  it.each(PART_KINDS)('%s: geschlossen, Kanten passen zusammen', (kind) => {
    expect(edgeProblems(kind)).toEqual([]);
  });

  it.each(PART_KINDS)('%s: positiver Rauminhalt (Dreiecke zeigen nach außen) und liegt im Einheitsquader', (kind) => {
    const m = unitMesh(kind);
    expect(meshVolume(m)).toBeGreaterThan(0.1);
    for (let i = 0; i < m.pos.length; i += 3) {
      expect(Math.abs(m.pos[i])).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(m.pos[i + 1])).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(m.pos[i + 2]).toBeGreaterThanOrEqual(-1e-9);
      expect(m.pos[i + 2]).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('Rauminhalte passen zu den Formeln', () => {
    expect(meshVolume(unitMesh('box'))).toBeCloseTo(1, 9);
    expect(meshVolume(unitMesh('roof'))).toBeCloseTo(0.5, 9);
    expect(meshVolume(unitMesh('pyramid'))).toBeCloseTo(1 / 3, 9);
    expect(meshVolume(unitMesh('cylinder'))).toBeCloseTo(Math.PI / 4, 2);
    expect(meshVolume(unitMesh('cone'))).toBeCloseTo(Math.PI / 12, 2);
    expect(meshVolume(unitMesh('sphere'))).toBeCloseTo((4 / 3) * Math.PI * 0.125, 2);
    expect(meshVolume(unitMesh('dome'))).toBeCloseTo((2 / 3) * Math.PI * 0.25, 2);
    // Ring: Röhre aus 24 Ecken -> knapp unter dem Kreis-Wert
    expect(meshVolume(unitMesh('ring')) / (2 * Math.PI ** 2 * 0.375 * 0.125 * 0.125 * 4)).toBeGreaterThan(0.97);
    expect(meshVolume(unitMesh('ring'))).toBeLessThan(2 * Math.PI ** 2 * 0.375 * 0.125 * 0.125 * 4);
  });

  it('füllt den Einheitsquader in x und y ganz aus (Maße stimmen)', () => {
    for (const kind of PART_KINDS) {
      const m = unitMesh(kind);
      let maxX = 0;
      let maxY = 0;
      let maxZ = 0;
      for (let i = 0; i < m.pos.length; i += 3) {
        maxX = Math.max(maxX, Math.abs(m.pos[i]));
        maxY = Math.max(maxY, Math.abs(m.pos[i + 1]));
        maxZ = Math.max(maxZ, m.pos[i + 2]);
      }
      expect(maxX).toBeCloseTo(0.5, 6);
      expect(maxY).toBeCloseTo(0.5, 6);
      expect(maxZ).toBeCloseTo(1, 6);
    }
  });
});
