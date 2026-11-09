// Fangen: beim Verschieben rasten Kanten und Mitten an Kanten/Mitten anderer Teile und der Zeichenfläche ein.
export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Führungslinie: senkrecht (axis 'x', bei x = pos) oder waagerecht (axis 'y', bei y = pos) von a bis b. */
export interface Guide {
  axis: 'x' | 'y';
  pos: number;
  a: number;
  b: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const lines = (b: Box, axis: 'x' | 'y'): number[] => (axis === 'x' ? [b.minX, (b.minX + b.maxX) / 2, b.maxX] : [b.minY, (b.minY + b.maxY) / 2, b.maxY]);
const span = (b: Box, axis: 'x' | 'y'): [number, number] => (axis === 'x' ? [b.minY, b.maxY] : [b.minX, b.maxX]);

/**
 * Verschiebung (dx, dy), mit der das Teil `moving` an die nächste Kante/Mitte der `targets` einrastet.
 * tol = Fangabstand in mm; je Richtung wird nur der nächste Treffer genommen.
 */
export function snapMove(moving: Box, targets: Box[], tol: number): SnapResult {
  const out: SnapResult = { dx: 0, dy: 0, guides: [] };
  for (const axis of ['x', 'y'] as const) {
    let best = { d: Infinity, pos: 0, target: null as Box | null };
    for (const t of targets) {
      for (const mine of lines(moving, axis)) {
        for (const theirs of lines(t, axis)) {
          const d = theirs - mine;
          if (Math.abs(d) <= tol && Math.abs(d) < Math.abs(best.d)) best = { d, pos: theirs, target: t };
        }
      }
    }
    if (!best.target) continue;
    if (axis === 'x') out.dx = best.d;
    else out.dy = best.d;
    // Linie von beiden Teilen aus (nach dem Einrasten) in der anderen Richtung
    const shifted: Box = axis === 'x' ? { ...moving, minX: moving.minX + best.d, maxX: moving.maxX + best.d } : { ...moving, minY: moving.minY + best.d, maxY: moving.maxY + best.d };
    const [a0, a1] = span(shifted, axis);
    const [b0, b1] = span(best.target, axis);
    out.guides.push({ axis, pos: best.pos, a: Math.min(a0, b0), b: Math.max(a1, b1) });
  }
  return out;
}

/** Fangabstand in mm für einen Bildschirmabstand von px Pixeln (k = mm pro Pixel). */
export const snapTolerance = (k: number, px = 9): number => px * k;
