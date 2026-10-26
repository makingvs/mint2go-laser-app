import { describe, expect, it } from 'vitest';
import { exportSvg } from '../src/svgExport';
import { DEFAULT_SETTINGS, makeElement, type El, type Op } from '../src/model';
import { baseShape } from '../src/shapes';
import { textShape, GLYPH_HEIGHT } from '../src/text';
import { shapeArea } from '../src/geometry';

const shape = (id: 'circle' | 'square' | 'star' | 'heart' | 'triangle', op: Op, x: number, y: number, size = 40): El =>
  makeElement({ kind: 'shape', ref: id, rings: baseShape(id), op, size, x, y });

describe('SVG-Export', () => {
  it('schreibt mm-Maße und viewBox der Platte', () => {
    const svg = exportSvg({ elements: [] }, { ...DEFAULT_SETTINGS, plate: { width: 300, height: 200 } });
    expect(svg).toContain('width="300mm"');
    expect(svg).toContain('height="200mm"');
    expect(svg).toContain('viewBox="0 0 300 200"');
  });

  it('erzeugt drei Ebenen mit festen Farben', () => {
    const svg = exportSvg({ elements: [shape('circle', 'cut', 60, 60), shape('star', 'engrave', 150, 60), shape('heart', 'fill', 240, 60)] }, DEFAULT_SETTINGS);
    expect(svg).toMatch(/id="schneiden"[^>]*stroke="#FF0000"/);
    expect(svg).toMatch(/id="gravieren"[^>]*stroke="#0000FF"/);
    expect(svg).toMatch(/id="flaechengravur"[^>]*fill="#000000"/);
    expect(svg).not.toMatch(/<(image|text|filter|use)\b/);
  });

  it('vereint überlappende Formen gleicher Art zu einem Umriss', () => {
    const svg = exportSvg({ elements: [shape('square', 'cut', 100, 100, 40), shape('square', 'cut', 120, 100, 40)] }, DEFAULT_SETTINGS);
    const d = /id="schneiden" d="([^"]+)"/.exec(svg)![1];
    expect((d.match(/M/g) ?? []).length).toBe(1);
    expect(d.split('L').length - 1).toBeLessThanOrEqual(3); // Rechteck: 4 Ecken
  });

  it('vereint nicht über verschiedene Bearbeitungsarten hinweg', () => {
    const svg = exportSvg({ elements: [shape('square', 'cut', 100, 100), shape('square', 'fill', 110, 100)] }, DEFAULT_SETTINGS);
    expect(svg).toContain('id="schneiden"');
    expect(svg).toContain('id="flaechengravur"');
  });

  it('exportiert offene Linien als offene Pfade und schließt sie bei Flächengravur', () => {
    const line = makeElement({ kind: 'free', ref: '', rings: [[[0, 0], [10, 5], [20, 0]]], op: 'engrave', size: 20, x: 50, y: 50, open: true });
    const svg = exportSvg({ elements: [line] }, DEFAULT_SETTINGS);
    const d = /id="gravieren" d="([^"]+)"/.exec(svg)![1];
    expect(d.endsWith('Z')).toBe(false);
    const filled = { ...line, op: 'fill' as Op };
    expect(exportSvg({ elements: [filled] }, DEFAULT_SETTINGS)).toContain('id="flaechengravur"');
  });

  it('wandelt Text in Pfade um', () => {
    const rings = textShape('LENA');
    expect(rings.length).toBeGreaterThanOrEqual(4);
    const el = makeElement({ kind: 'text', ref: 'LENA', rings, op: 'fill', size: 120, x: 150, y: 100 });
    const svg = exportSvg({ elements: [el] }, DEFAULT_SETTINGS);
    expect(svg).toContain('id="flaechengravur"');
    expect(svg).not.toContain('<text');
  });
});

describe('Text', () => {
  it('bildet Buchstaben mit Löchern (O, A, B)', () => {
    const o = textShape('O');
    expect(o).toHaveLength(2);
    expect(textShape('B')).toHaveLength(3);
    expect(textShape('A')).toHaveLength(2);
  });

  it('hat sinnvolle Höhe und Dicke', () => {
    const s = textShape('H');
    const ys = s.flat().map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(GLYPH_HEIGHT, 0);
    expect(shapeArea(s)).toBeGreaterThan(10);
  });

  it('kennt Umlaute, Ziffern und Kleinbuchstaben', () => {
    expect(textShape('äöü').length).toBeGreaterThan(5);
    expect(textShape('0123456789').length).toBeGreaterThan(10);
    expect(textShape('anna')).toEqual(textShape('ANNA'));
  });
});
