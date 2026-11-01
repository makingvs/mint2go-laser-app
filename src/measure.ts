// Messen: Abstand zwischen zwei Punkten auf der Fläche; Endpunkte rasten an Ecken und Mitten der Teile ein.
import type { Pt } from './geometry';
import type { Box } from './snap';

/** Fangpunkte eines Rahmens: Ecken, Kantenmitten, Mitte */
export function boxPoints(b: Box): Pt[] {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return [
    [b.minX, b.minY], [cx, b.minY], [b.maxX, b.minY],
    [b.minX, cy], [cx, cy], [b.maxX, cy],
    [b.minX, b.maxY], [cx, b.maxY], [b.maxX, b.maxY],
  ];
}

/** Nächster Fangpunkt innerhalb von tol (mm), sonst der Punkt selbst */
export function snapToPoint(p: Pt, pts: Pt[], tol: number): Pt {
  let best = p;
  let d = tol;
  for (const q of pts) {
    const dq = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dq <= d) {
      d = dq;
      best = q;
    }
  }
  return best;
}

const mm = (n: number) => String(+n.toFixed(1)).replace('.', ',');

/** Beschriftung: Länge und die Abstände waagerecht/senkrecht */
export function measureLabel(a: Pt, b: Pt): { main: string; sub: string } {
  const dx = Math.abs(b[0] - a[0]);
  const dy = Math.abs(b[1] - a[1]);
  return { main: `${mm(Math.hypot(dx, dy))} mm`, sub: `↔ ${mm(dx)}  ↕ ${mm(dy)}` };
}
