import { describe, expect, it } from 'vitest';
import { combine, loadManifold, toManifold } from '../app3d/src/csg';
import { createPart, makeOutlinePart, type Part } from '../app3d/src/model3d';
import { MSG, freeProblems, minWall, thinText } from '../app3d/src/problems3d';
import { buildFinal, printCheck, type FinalModel } from '../app3d/src/printExport';

const bed = { width: 200, depth: 200, height: 100 };
const box = (x: number, y: number, z: number, w: number, d = w, h = w): Part => ({ ...createPart('box', x, y), z, w, d, h });

describe('Sätze zu den Warnzeichen', () => {
  it('zu dünn nennt die kleinste druckbare Größe für die Düse', () => {
    expect(minWall(0.4)).toBeCloseTo(0.8);
    expect(thinText(0.4)).toContain('0,8 mm');
    expect(thinText(0.6)).toContain('1,2 mm');
  });

  it('freie Arbeit: nur die wirklichen Probleme werden genannt', () => {
    const ok = { empty: false, outside: false, floating: false, thin: false };
    expect(freeProblems(ok, 0.4)).toEqual([]);
    expect(freeProblems({ ...ok, outside: true, floating: true }, 0.4).map((p) => p.kind)).toEqual(['outside', 'floating']);
    expect(freeProblems({ ...ok, thin: true }, 0.4)[0].text).toBe(thinText(0.4));
  });

  it('alle festen Sätze sind kurz und nicht leer', () => {
    for (const t of Object.values(MSG)) {
      expect(t.length).toBeGreaterThan(10);
      expect(t.length).toBeLessThan(180);
    }
  });
});

describe('Ganz kleine Körper', () => {
  it('Würfel von 0,1 mm: zu klein zum Drucken (zu dünn), aber als Körper in Ordnung', async () => {
    const tiny = box(0, 0, 0, 0.1);
    const f = (await buildFinal([tiny])) as FinalModel;
    expect(f.components).toHaveLength(1);
    expect(printCheck([tiny], f, bed, 0.4).thin).toBe(true);
    expect(printCheck([box(0, 0, 0, 1)], f, bed, 0.4).thin).toBe(false);
    expect(printCheck([box(0, 0, 0, 10, 10, 0.5)], f, bed, 0.4).thin).toBe(true); // flache Platte
  });

  it('gezeichneter Körper darf auf 0,1 mm Höhe schrumpfen', () => {
    const rect: [number, number][] = [[0, 0], [20, 0], [20, 10], [0, 10]];
    const p = makeOutlinePart([rect], { longest: 20 }, 0.1, bed)!;
    expect(p.h).toBe(0.1);
  });
});

describe('Vereinen: Erklärung statt nur Warnzeichen', () => {
  it('berühren sich die Körper nicht: Ergebnis "none" (dann kommt der Satz zum Zusammenschieben)', async () => {
    const a = box(0, 0, 0, 10);
    const b = box(50, 0, 0, 10);
    expect((await combine(a.id, [a, b])).kind).toBe('none');
    expect((await combine(a.id, [a])).kind).toBe('none');
  });

  it('berühren sie sich, wird vereint; auch winzige Teile', async () => {
    const a = box(0, 0, 0, 10);
    const b = box(5, 0, 0, 10);
    expect((await combine(a.id, [a, b])).kind).toBe('ok');
    const t1 = box(0, 0, 0, 0.3);
    const t2 = box(0.15, 0, 0, 0.3);
    expect((await combine(t1.id, [t1, t2])).kind).toBe('ok');
  });

  it('toManifold repariert ein Netz mit doppelten Eckpunkten (verschweißt sie)', async () => {
    const m = await loadManifold();
    const p = box(0, 0, 0, 10);
    const man = toManifold(m, p);
    expect(man).not.toBeNull();
    man!.delete();
  });
});
