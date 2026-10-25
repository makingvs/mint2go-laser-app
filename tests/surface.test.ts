import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, makeElement, type El } from '../src/model';
import { baseShape } from '../src/shapes';
import { bbox, shapeArea } from '../src/geometry';
import { exportSvg } from '../src/svgExport';
import {
  builtinShapeSurface,
  defaultSurface,
  ellipseSurface,
  exportFrame,
  fixedView,
  freeSurface,
  growView,
  isOutside,
  normalizeSurface,
  rectSurface,
  shapeSurface,
  surfaceShape,
} from '../src/surface';

const sq = (x: number, y: number, size = 20): El => makeElement({ kind: 'shape', ref: 'square', rings: baseShape('square'), op: 'cut', size, x, y });

describe('Zeichenfläche: Umrisse', () => {
  it('Rechteck, Kreis und Form haben die eingegebenen Maße in mm', () => {
    const r = bbox(surfaceShape(rectSurface(120, 80)));
    expect([r.minX, r.minY, r.maxX, r.maxY]).toEqual([0, 0, 120, 80]);

    const c = ellipseSurface(100, 100);
    const cb = bbox(surfaceShape(c));
    expect(cb.maxX - cb.minX).toBeCloseTo(100, 6);
    expect(shapeArea(surfaceShape(c))).toBeCloseTo(Math.PI * 50 * 50, -1);

    const heart = builtinShapeSurface('heart', 150);
    expect(Math.max(heart.w, heart.h)).toBeCloseTo(150, 6);
    const hb = bbox(surfaceShape(heart));
    expect(hb.minX).toBeCloseTo(0, 6);
    expect(hb.maxX).toBeCloseTo(heart.w, 6);

    expect(surfaceShape(freeSurface())).toEqual([]);
  });

  it('übernimmt einen eigenen Umriss mit Seitenverhältnis', () => {
    const s = shapeSurface('lib:x', [[[0, 0], [40, 0], [40, 20], [0, 20]]], 200);
    expect(s.w).toBeCloseTo(200, 6);
    expect(s.h).toBeCloseTo(100, 6);
  });

  it('prüft und begrenzt geladene Flächen', () => {
    const fb = defaultSurface(DEFAULT_SETTINGS);
    expect(normalizeSurface(undefined, fb)).toEqual(fb);
    expect(normalizeSurface({ kind: 'rect', w: 5, h: 5000 }, fb)).toMatchObject({ kind: 'rect', w: 10, h: 1000 });
    expect(normalizeSurface({ kind: 'free' }, fb).kind).toBe('free');
    expect(normalizeSurface({ kind: 'shape', ref: 'x', w: 50, h: 50 }, fb)).toEqual(fb); // Umriss fehlt
    expect(normalizeSurface({ kind: 'ellipse', w: 'x', h: 3 }, fb)).toEqual(fb);
  });
});

describe('Zeichenfläche: Ansicht', () => {
  it('zeigt bei fester Fläche die Fläche mit Rand', () => {
    const v = fixedView(rectSurface(100, 50));
    expect(v.x).toBeLessThan(0);
    expect(v.x + v.w).toBeGreaterThan(100);
    expect(v.y + v.h).toBeGreaterThan(50);
  });

  it('unendliche Fläche wächst mit dem Inhalt und schrumpft nie', () => {
    const v0 = growView(null, []);
    expect(v0.w).toBeGreaterThanOrEqual(300);
    const far = sq(900, -400);
    const v1 = growView(v0, [far]);
    expect(v1.x + v1.w).toBeGreaterThan(900);
    expect(v1.y).toBeLessThan(-400);
    const v2 = growView(v1, []); // Teil entfernt
    expect(v2).toEqual(v1);
  });
});

describe('Zeichenfläche: Warnung und Export', () => {
  it('erkennt Teile, die über das Werkstück hinausstehen (auch bei rundem Werkstück)', () => {
    const rect = rectSurface(100, 100);
    expect(isOutside(sq(50, 50, 40), rect)).toBe(false);
    expect(isOutside(sq(90, 50, 40), rect)).toBe(true);
    expect(isOutside(sq(5, 5, 40), freeSurface())).toBe(false);
    const circle = ellipseSurface(100, 100);
    expect(isOutside(sq(50, 50, 60), circle)).toBe(false); // Ecken liegen bei r = 42 < 50
    expect(isOutside(sq(50, 50, 80), circle)).toBe(true); // Ecken bei r = 56 > 50
  });

  it('exportiert in der Größe des Werkstücks', () => {
    const svg = exportSvg({ elements: [sq(60, 40, 20)], surface: rectSurface(120, 80) }, DEFAULT_SETTINGS);
    expect(svg).toContain('width="120mm" height="80mm" viewBox="0 0 120 80"');
    const round = exportSvg({ elements: [sq(50, 50, 20)], surface: ellipseSurface(100, 100) }, DEFAULT_SETTINGS);
    expect(round).toContain('width="100mm" height="100mm"');
  });

  it('exportiert die unendliche Fläche als Inhaltsrahmen ab Punkt 0/0', () => {
    const els = [sq(500, 300, 20), sq(540, 330, 20)]; // von 490/290 bis 550/340
    const frame = exportFrame({ elements: els, surface: freeSurface() }, DEFAULT_SETTINGS);
    expect(frame.w).toBeCloseTo(60, 6);
    expect(frame.h).toBeCloseTo(50, 6);
    const svg = exportSvg({ elements: els, surface: freeSurface() }, DEFAULT_SETTINGS);
    expect(svg).toContain('width="60mm" height="50mm" viewBox="0 0 60 50"');
    expect(svg).toContain('M0 0'); // erstes Quadrat startet an der Ecke 0/0
  });

  it('nimmt für ältere Arbeiten ohne Fläche die Standardgröße', () => {
    const svg = exportSvg({ elements: [] }, { ...DEFAULT_SETTINGS, plate: { width: 250, height: 150 } });
    expect(svg).toContain('width="250mm" height="150mm"');
  });
});
