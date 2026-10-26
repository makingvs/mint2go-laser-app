import { describe, expect, it } from 'vitest';
import { bbox, pointInShape, shapeArea } from '../src/geometry';
import { darkFraction, fitSize, grayFromRGBA, otsu, traceGray, type GrayImage } from '../src/trace';

/** Testbild: weiß, mit dunklen Formen nach Vorschrift f(x,y) -> true = dunkel */
function image(w: number, h: number, dark: (x: number, y: number) => boolean): GrayImage {
  const data = new Uint8Array(w * h).fill(250);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dark(x, y)) data[y * w + x] = 20;
  return { w, h, data };
}

describe('Bild -> Vektor', () => {
  it('zeichnet eine dunkle Scheibe als einen geschlossenen Umriss nach', () => {
    const img = image(100, 100, (x, y) => (x - 50) ** 2 + (y - 50) ** 2 < 30 ** 2);
    const shape = traceGray(img, { threshold: otsu(img) });
    expect(shape).toHaveLength(1);
    const b = bbox(shape);
    expect(b.maxX - b.minX).toBeGreaterThan(55);
    expect(b.maxX - b.minX).toBeLessThan(65);
    expect(shapeArea(shape)).toBeGreaterThan(Math.PI * 28 * 28);
    expect(pointInShape([50, 50], shape)).toBe(true);
    expect(pointInShape([5, 5], shape)).toBe(false);
  });

  it('erkennt Löcher (Ring)', () => {
    const img = image(120, 120, (x, y) => {
      const d = (x - 60) ** 2 + (y - 60) ** 2;
      return d < 45 ** 2 && d > 20 ** 2;
    });
    const shape = traceGray(img, { threshold: 128 });
    expect(shape).toHaveLength(2);
    expect(pointInShape([60, 60], shape)).toBe(false); // Loch
    expect(pointInShape([60, 25], shape)).toBe(true); // Ring
  });

  it('Umkehren macht aus dem hellen Hintergrund den Vordergrund', () => {
    const img = image(100, 100, (x, y) => (x - 50) ** 2 + (y - 50) ** 2 < 30 ** 2);
    const inv = traceGray(img, { threshold: 128, invert: true });
    expect(pointInShape([5, 5], inv)).toBe(true);
    expect(pointInShape([50, 50], inv)).toBe(false);
  });

  it('ignoriert winzige Flecken (Rauschen)', () => {
    const img = image(200, 200, (x, y) => (x >= 80 && x < 120 && y >= 80 && y < 120) || (x >= 10 && x < 12 && y >= 10 && y < 12));
    const shape = traceGray(img, { threshold: 128 });
    expect(shape).toHaveLength(1);
  });

  it('liefert für ein leeres weißes Bild nichts', () => {
    expect(traceGray(image(50, 50, () => false), { threshold: 128 })).toEqual([]);
  });

  it('findet den Schwellwert zwischen Dunkel und Hell (Otsu)', () => {
    const img = image(60, 60, (x) => x < 30);
    const t = otsu(img);
    expect(t).toBeGreaterThan(19);
    expect(t).toBeLessThan(250);
    expect(darkFraction(img, t)).toBeCloseTo(0.5, 2);
  });
});

describe('Bild lesen', () => {
  it('rechnet RGBA in Helligkeit um, Transparenz zählt als weiß', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 0, 0, 0, 255, 255, 255, 255]);
    const g = grayFromRGBA(rgba, 3, 1);
    expect(g.data[0]).toBe(0);
    expect(g.data[1]).toBe(255); // volltransparent
    expect(g.data[2]).toBe(255);
  });

  it('verkleinert große Bilder, vergrößert nie', () => {
    expect(fitSize(2000, 1000)).toEqual({ w: 512, h: 256 });
    expect(fitSize(100, 50)).toEqual({ w: 100, h: 50 });
    expect(fitSize(1, 5000).h).toBe(512);
  });
});
