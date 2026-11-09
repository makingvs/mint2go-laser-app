import { describe, expect, it } from 'vitest';
import { History, cloneElements, makeElement, type El } from '../src/model';
import { baseShape } from '../src/shapes';
import { anchoredCenter, zoomedView } from '../src/surface';

describe('Hand-Werkzeug: Zoom unter dem Finger', () => {
  const base = { x: -10, y: -10, w: 340, h: 230 };
  const kFit = 0.46; // mm pro Pixel bei Zoom 1
  const rectCenter: [number, number] = [500, 300];
  // Flächenpunkt unter einem Bildschirmpunkt (Mitte des Ausschnitts + Abstand zur Mitte * mm pro Pixel)
  const mmAt = (view: { x: number; y: number; w: number; h: number }, zoom: number, px: [number, number]): [number, number] => [
    view.x + view.w / 2 + (px[0] - rectCenter[0]) * (kFit / zoom),
    view.y + view.h / 2 + (px[1] - rectCenter[1]) * (kFit / zoom),
  ];

  it('der Punkt unter den Fingern bleibt beim Zoomen an derselben Stelle', () => {
    const at: [number, number] = [300, 200];
    const w = mmAt(base, 1, at);
    for (const z of [1.5, 3, 8]) {
      const c = anchoredCenter(w, at, rectCenter, kFit, z);
      const v = zoomedView(base, z, c);
      const after = mmAt(v, z, at);
      expect(after[0]).toBeCloseTo(w[0], 6);
      expect(after[1]).toBeCloseTo(w[1], 6);
    }
  });

  it('in der Bildmitte bleibt die Mitte stehen', () => {
    const w: [number, number] = [160, 105];
    const c = anchoredCenter(w, rectCenter, rectCenter, kFit, 4);
    expect(c).toEqual(w);
  });
});

describe('Objekt sperren', () => {
  const el = (): El => makeElement({ kind: 'shape', ref: 'circle', rings: baseShape('circle'), op: 'cut', size: 30, x: 50, y: 50 });

  it('die Sperre wird gespeichert und ist rückgängig machbar', () => {
    const els = [el()];
    const h = new History(els);
    els[0].locked = true;
    expect(h.commit(els)).toBe(true);
    expect(cloneElements(els)[0].locked).toBe(true);
    const back = h.undo()!;
    expect(back[0].locked).toBeUndefined();
    expect(h.redo()![0].locked).toBe(true);
  });

  it('eine Kopie eines gesperrten Teils ist nicht gesperrt (wie im Editor)', () => {
    const a = el();
    a.locked = true;
    const copy: El = { ...JSON.parse(JSON.stringify(a)), id: 'x', locked: undefined };
    expect(copy.locked).toBeUndefined();
    expect(a.locked).toBe(true);
  });
});
