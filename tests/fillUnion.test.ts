import { describe, expect, it } from 'vitest';
import { pointInShape, type Pt, type Shape } from '../src/geometry';
import { makeElement, worldShape, type El } from '../src/model';
import { baseShape, type ShapeId } from '../src/shapes';
import { buildPaths } from '../src/svgExport';
import { textShape } from '../src/text';

// kleiner, wiederholbarer Zufallsgenerator
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('Flächengravur: Vereinigung verliert nichts', () => {
  it('jede Stelle, die gefüllt angezeigt wird, ist auch im Export gefüllt', () => {
    const ids: ShapeId[] = ['circle', 'square', 'star', 'heart', 'flower', 'ring', 'frame', 'roundrect', 'cloud', 'moon'];
    let worst = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed * 7919);
      const els: El[] = [];
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const id = ids[Math.floor(r() * ids.length)];
        const el = makeElement({ kind: 'shape', ref: id, rings: baseShape(id), op: 'fill', size: 30 + r() * 60, x: 50 + r() * 100, y: 50 + r() * 100 });
        el.rot = r() * 360;
        els.push(el);
      }
      if (seed % 3 === 0) els.push(makeElement({ kind: 'text', ref: 'A', rings: textShape('ANNA'), op: 'fill', size: 90, x: 100, y: 100 }));
      const shown: Shape[] = els.map(worldShape);
      const out = buildPaths(els).fill.closed;
      let wrong = 0;
      const total = 3000;
      for (let k = 0; k < total; k++) {
        const p: Pt = [r() * 220, r() * 220];
        if (shown.some((s) => pointInShape(p, s)) !== pointInShape(p, out)) wrong++;
      }
      worst = Math.max(worst, wrong / total);
    }
    expect(worst).toBeLessThan(0.002);
  });
});
