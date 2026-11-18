// Reine Rechenhilfen (ohne DOM) – getestet in tests/geometry.test.ts.

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Circle extends Pt { r: number }

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Nächster Punkt auf der Strecke a-b: Abstand d und Position t (0..1). */
export function nearestOnSegment(p: Pt, a: Pt, b: Pt): { d: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), t };
}

export function polylineLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

/** Nächster Punkt auf einer Linie: Abstand d und Weg 'along' ab dem Anfang. */
export function nearestOnPolyline(p: Pt, pts: Pt[]): { d: number; along: number } {
  let best = { d: Infinity, along: 0 };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    const n = nearestOnSegment(p, pts[i - 1], pts[i]);
    if (n.d < best.d) best = { d: n.d, along: acc + n.t * seg };
    acc += seg;
  }
  return best;
}

/** Punkt in der Entfernung s vom Anfang der Linie. */
export function pointAlong(pts: Pt[], s: number): Pt {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (acc + seg >= s && seg > 0) {
      const t = (s - acc) / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    acc += seg;
  }
  return { ...pts[pts.length - 1] };
}

/** Rundet die Ecken einer Linie (quadratische Kurven) und liefert viele Punkte. */
export function roundedPath(pts: Pt[], radius: number, steps = 10): Pt[] {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const out: Pt[] = [{ ...pts[0] }];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const v = pts[i];
    const b = pts[i + 1];
    const la = dist(a, v);
    const lb = dist(v, b);
    const r = Math.min(radius, la / 2, lb / 2);
    const p1 = { x: v.x + ((a.x - v.x) / la) * r, y: v.y + ((a.y - v.y) / la) * r };
    const p2 = { x: v.x + ((b.x - v.x) / lb) * r, y: v.y + ((b.y - v.y) / lb) * r };
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push({
        x: u * u * p1.x + 2 * u * t * v.x + t * t * p2.x,
        y: u * u * p1.y + 2 * u * t * v.y + t * t * p2.y,
      });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

export const normAngle = (a: number): number => ((a % 360) + 360) % 360;

/** Kleinster Winkelunterschied in Grad (0..180). */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normAngle(a) - normAngle(b));
  return Math.min(d, 360 - d);
}

/** Kleiner, schneller Zufallsgenerator mit Startwert (für Tests und gleiche Aufgaben). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Verteilt n Kreise (Radius r) ohne Überlappung in einer Fläche. Findet sich bei dichter
 * Belegung keine Lösung, wird der Abstand schrittweise kleiner – es kommen immer n Punkte zurück.
 */
export function placeNonOverlapping(
  rng: () => number,
  n: number,
  r: number,
  area: Rect,
  gap = 12,
  avoid: Circle[] = [],
  maxTries = 300,
): Pt[] {
  const placed: Pt[] = [];
  for (let i = 0; i < n; i++) {
    let g = gap;
    let found: Pt | null = null;
    while (!found) {
      for (let t = 0; t < maxTries && !found; t++) {
        const p = {
          x: area.x + r + rng() * Math.max(0, area.w - 2 * r),
          y: area.y + r + rng() * Math.max(0, area.h - 2 * r),
        };
        const okOwn = placed.every((q) => dist(p, q) >= 2 * r + g);
        const okAvoid = avoid.every((c) => dist(p, c) >= r + c.r + g);
        if (okOwn && okAvoid) found = p;
      }
      if (!found) {
        if (g <= -r) {
          // Notlösung: irgendwo hin (kann nur bei unmöglich dichter Belegung passieren)
          found = { x: area.x + r + rng() * Math.max(0, area.w - 2 * r), y: area.y + r + rng() * Math.max(0, area.h - 2 * r) };
        } else g -= 6;
      }
    }
    placed.push(found);
  }
  return placed;
}

/** Index des nächsten Ziels (Kreis) innerhalb von maxDist, sonst -1. */
export function nearestTarget(p: Pt, targets: Pt[], maxDist: number): number {
  let best = -1;
  let bd = maxDist;
  targets.forEach((t, i) => {
    const d = dist(p, t);
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
