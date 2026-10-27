// Druckbett und Bauraum des 3D-Druckers. Maße in Millimetern.
// Koordinaten: Ursprung in der Mitte des Betts, x nach rechts, y nach hinten, z nach oben (z = 0 ist das Bett).

export interface Bed {
  width: number; // x
  depth: number; // y
  height: number; // z (maximale Bauhöhe)
}

export interface PrinterSettings {
  bed: Bed;
  nozzle: number; // Düsendurchmesser in mm
}

export const DEFAULT_PRINTER: PrinterSettings = { bed: { width: 220, depth: 220, height: 250 }, nozzle: 0.4 };

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Prüft und begrenzt Einstellungen aus config.json (fehlende/falsche Werte -> Standard). */
export function normalizePrinter(input: unknown, base: PrinterSettings = DEFAULT_PRINTER): PrinterSettings {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const b = (o.bed && typeof o.bed === 'object' ? o.bed : {}) as Record<string, unknown>;
  return {
    bed: {
      width: num(b.width, 50, 1000, base.bed.width),
      depth: num(b.depth, 50, 1000, base.bed.depth),
      height: num(b.height, 20, 1000, base.bed.height),
    },
    nozzle: num(o.nozzle, 0.1, 2, base.nozzle),
  };
}

export interface Box3 {
  min: [number, number, number];
  max: [number, number, number];
}

/** Liegt der Körper komplett im Bauraum? (mit kleiner Toleranz) */
export function fitsInBuildVolume(box: Box3, bed: Bed, tolerance = 0.01): boolean {
  return (
    box.min[0] >= -bed.width / 2 - tolerance &&
    box.max[0] <= bed.width / 2 + tolerance &&
    box.min[1] >= -bed.depth / 2 - tolerance &&
    box.max[1] <= bed.depth / 2 + tolerance &&
    box.min[2] >= -tolerance &&
    box.max[2] <= bed.height + tolerance
  );
}
