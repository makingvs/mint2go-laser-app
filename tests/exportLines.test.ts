import { describe, expect, it } from 'vitest';
import { exportSvg, buildPaths } from '../src/svgExport';
import { removeDoubledLines, type Pt } from '../src/geometry';
import { DEFAULT_SETTINGS, makeElement, type El, type Op } from '../src/model';
import { baseShape } from '../src/shapes';
import { rectSurface } from '../src/surface';

const shape = (id: 'circle' | 'square' | 'star', op: Op, x: number, y: number, size = 40): El =>
  makeElement({ kind: 'shape', ref: id, rings: baseShape(id), op, size, x, y });
const subpaths = (svg: string, id: string): number => {
  const m = new RegExp(`id="${id}" d="([^"]+)"`).exec(svg);
  return m ? (m[1].match(/M/g) ?? []).length : 0;
};

describe('Export: alles, was man sieht, kommt in die Datei', () => {
  it('Form in einer Form bleibt erhalten (Loch im Anhänger)', () => {
    const svg = exportSvg({ elements: [shape('square', 'cut', 100, 100, 60), shape('circle', 'cut', 100, 90, 5)] }, DEFAULT_SETTINGS);
    expect(subpaths(svg, 'schneiden')).toBe(2);
  });

  it('viele Löcher im Fensterbild bleiben alle erhalten', () => {
    const els = [shape('circle', 'cut', 100, 100, 120)];
    for (let i = 0; i < 6; i++) els.push(shape('star', 'cut', 70 + i * 12, 100, 8));
    expect(subpaths(exportSvg({ elements: els }, DEFAULT_SETTINGS), 'schneiden')).toBe(7);
  });

  it('gilt auch für Gravieren (Gesicht in einem Kreis)', () => {
    const svg = exportSvg({ elements: [shape('circle', 'engrave', 100, 100, 80), shape('circle', 'engrave', 85, 90, 10), shape('circle', 'engrave', 115, 90, 10)] }, DEFAULT_SETTINGS);
    expect(subpaths(svg, 'gravieren')).toBe(3);
  });

  it('überlappende Formen behalten alle sichtbaren Linien', () => {
    const svg = exportSvg({ elements: [shape('square', 'cut', 100, 100, 40), shape('circle', 'cut', 120, 100, 40)] }, DEFAULT_SETTINGS);
    expect(subpaths(svg, 'schneiden')).toBe(2);
  });

  it('exakt gleiche Linien werden nur einmal geschnitten', () => {
    const a = shape('square', 'cut', 100, 100, 40);
    const copy = { ...a, id: 'copy' };
    const svg = exportSvg({ elements: [a, copy] }, DEFAULT_SETTINGS);
    expect(subpaths(svg, 'schneiden')).toBe(1);
  });

  it('gemeinsame Kante zweier Rechtecke nur einmal', () => {
    const a = shape('square', 'cut', 100, 100, 40);
    const b = shape('square', 'cut', 140, 100, 40);
    const p = buildPaths([a, b]).cut;
    const total = [...p.closed, ...p.open].reduce((n, r) => n + r.length, 0);
    expect(total).toBeGreaterThan(0);
    // Länge: 2 × Umfang − 2 × gemeinsame Kante ... gemeinsame Kante einmal abgezogen
    const len = (pts: Pt[], closed: boolean) => {
      let s = 0;
      for (let i = 0; i + 1 < pts.length; i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (closed) s += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
      return s;
    };
    const sum = p.closed.reduce((n, r) => n + len(r, true), 0) + p.open.reduce((n, r) => n + len(r, false), 0);
    expect(sum).toBeCloseTo(160 + 160 - 40, 6);
  });

  it('Flächengravur wird weiter vereint (keine Löcher durch Überlappung)', () => {
    const svg = exportSvg({ elements: [shape('square', 'fill', 100, 100, 40), shape('square', 'fill', 120, 100, 40)] }, DEFAULT_SETTINGS);
    expect(subpaths(svg, 'flaechengravur')).toBe(1);
  });

  it('gerade Linie mit Füllen geht nicht verloren', () => {
    const line = makeElement({ kind: 'free', ref: '', rings: [[[0, 0], [10, 0], [20, 0]]], op: 'fill', size: 20, x: 50, y: 50, open: true, exact: { w: 20, h: 0.01 } });
    const svg = exportSvg({ elements: [line] }, DEFAULT_SETTINGS);
    expect(svg).toMatch(/<path /);
  });

  it('Teile über der Zeichenfläche werden nicht abgeschnitten', () => {
    const svg = exportSvg({ elements: [shape('square', 'cut', 0, 0, 40)], surface: rectSurface(100, 100) }, DEFAULT_SETTINGS);
    expect(svg).toContain('width="120mm"');
    expect(svg).toContain('viewBox="0 0 120 120"');
    expect(svg).toContain('M0 0');
  });

  it('ohne Überstand bleibt die Dateigröße die der Fläche', () => {
    const svg = exportSvg({ elements: [shape('square', 'cut', 50, 50, 40)], surface: rectSurface(100, 100) }, DEFAULT_SETTINGS);
    expect(svg).toContain('viewBox="0 0 100 100"');
  });
});

describe('removeDoubledLines', () => {
  const sq = (x: number, y: number, s: number): Pt[] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];

  it('lässt fremde Linien unverändert', () => {
    const out = removeDoubledLines([{ pts: sq(0, 0, 10), closed: true }, { pts: sq(20, 0, 10), closed: true }]);
    expect(out).toHaveLength(2);
    expect(out.every((l) => l.closed)).toBe(true);
  });

  it('entfernt nur den überdeckten Teil einer längeren Kante', () => {
    const out = removeDoubledLines([{ pts: [[0, 0], [10, 0]], closed: false }, { pts: [[-5, 0], [20, 0]], closed: false }]);
    expect(out).toHaveLength(3);
    const parts = out.slice(1).map((l) => l.pts);
    expect(parts).toEqual([[[-5, 0], [0, 0]], [[10, 0], [20, 0]]]);
  });

  it('entfernt Doppelungen auch bei umgekehrter Richtung', () => {
    const a: Pt[] = sq(0, 0, 10);
    const out = removeDoubledLines([{ pts: a, closed: true }, { pts: [...a].reverse(), closed: true }]);
    expect(out).toHaveLength(1);
  });
});
