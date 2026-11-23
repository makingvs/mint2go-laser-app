// Freihand: aus einem gezeichneten Strich wird eine Linie (offen) oder ein Umriss (geschlossen).
import { dist, resample, simplify, smooth, type Pt, type Ring } from './geometry';

/** smooth = geglättet (Wackler werden ausgeglichen), raw = genau so, wie gezeichnet */
export type StrokeStyle = 'smooth' | 'raw';

/** kürzere Striche gelten als versehentliches Antippen */
const MIN_LENGTH = 8;
/** Wie gezeichnet: nur so nah beieinander liegende Punkte fallen weg (mm) */
const RAW_EPS = 0.05;
/** Wie gezeichnet: geschlossen, wenn sich Anfang und Ende fast berühren (mm) */
const RAW_CLOSE = 3;

export function strokeToRing(raw: Pt[], style: StrokeStyle, forceClosed: boolean): { ring: Ring; closed: boolean } | null {
  let length = 0;
  for (let i = 1; i < raw.length; i++) length += dist(raw[i - 1], raw[i]);
  if (raw.length < 3 || length < MIN_LENGTH) return null;

  if (style === 'raw') {
    const closed = forceClosed || dist(raw[0], raw[raw.length - 1]) < RAW_CLOSE;
    let pts = raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > RAW_EPS);
    if (closed && pts.length > 3 && dist(pts[0], pts[pts.length - 1]) <= RAW_EPS) pts = pts.slice(0, -1);
    const ring = simplify(pts, RAW_EPS);
    return ring.length >= (closed ? 3 : 2) ? { ring, closed } : null;
  }

  const nearClosed = dist(raw[0], raw[raw.length - 1]) < Math.max(8, length * 0.2);
  const closed = nearClosed || forceClosed;
  let pts = resample(raw, 1.5, false);
  let ring: Ring;
  if (closed) {
    if (pts.length > 3 && dist(pts[0], pts[pts.length - 1]) < 4) pts = pts.slice(0, -1);
    pts = smooth(pts, 5, true);
    const s = simplify([...pts, pts[0]], 0.25);
    s.pop();
    ring = s;
  } else {
    ring = simplify(smooth(pts, 5, false), 0.25);
  }
  return ring.length >= (closed ? 3 : 2) ? { ring, closed } : null;
}
