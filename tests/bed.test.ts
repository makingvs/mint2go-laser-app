import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER, fitsInBuildVolume, normalizePrinter } from '../app3d/src/bed';

describe('Druckbett', () => {
  it('nimmt gültige Werte aus der Konfiguration', () => {
    const p = normalizePrinter({ bed: { width: 256, depth: 256, height: 256 }, nozzle: 0.6 });
    expect(p.bed).toEqual({ width: 256, depth: 256, height: 256 });
    expect(p.nozzle).toBe(0.6);
  });

  it('ersetzt fehlende oder falsche Werte durch den Standard', () => {
    expect(normalizePrinter(null)).toEqual(DEFAULT_PRINTER);
    expect(normalizePrinter({ bed: { width: 'x', depth: NaN }, nozzle: null })).toEqual(DEFAULT_PRINTER);
  });

  it('begrenzt unsinnige Maße', () => {
    const p = normalizePrinter({ bed: { width: 5, depth: 99999, height: -3 }, nozzle: 50 });
    expect(p.bed).toEqual({ width: 50, depth: 1000, height: 20 });
    expect(p.nozzle).toBe(2);
  });

  it('erkennt, ob ein Körper in den Bauraum passt', () => {
    const bed = { width: 200, depth: 200, height: 100 };
    expect(fitsInBuildVolume({ min: [-100, -100, 0], max: [100, 100, 100] }, bed)).toBe(true);
    expect(fitsInBuildVolume({ min: [-101, 0, 0], max: [0, 10, 10] }, bed)).toBe(false);
    expect(fitsInBuildVolume({ min: [0, 0, -1], max: [10, 10, 10] }, bed)).toBe(false); // unter dem Bett
    expect(fitsInBuildVolume({ min: [0, 0, 0], max: [10, 10, 101] }, bed)).toBe(false); // zu hoch
  });
});
