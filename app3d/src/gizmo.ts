// Rechnung für die Griffe am gewählten Körper (reine Rechnung, ohne three.js -> testbar).
import { MIN_SIZE, normalizeRot, limitFactor, withSize, type Part } from './model3d';
import type { Vec3 } from './orbit';

/** Schnittpunkt eines Strahls mit der waagrechten Ebene z = zPlane (nur vor der Kamera), sonst null. */
export function rayPlaneZ(origin: Vec3, dir: Vec3, zPlane: number): [number, number] | null {
  if (Math.abs(dir[2]) < 1e-9) return null;
  const t = (zPlane - origin[2]) / dir[2];
  if (t <= 0) return null;
  return [origin[0] + dir[0] * t, origin[1] + dir[1] * t];
}

/** Höhe z des Punkts auf der senkrechten Linie durch (x, y), der dem Strahl am nächsten liegt; null wenn parallel. */
export function closestZOnVertical(origin: Vec3, dir: Vec3, x: number, y: number): number | null {
  const w: Vec3 = [origin[0] - x, origin[1] - y, origin[2]];
  const a = dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2];
  const b = dir[2];
  const d = dir[0] * w[0] + dir[1] * w[1] + dir[2] * w[2];
  const e = w[2];
  const denom = a - b * b;
  if (denom < 1e-9) return null;
  return (a * e - b * d) / denom;
}

/** Punkt (Weltkoordinaten) im Koordinatensystem des Körpers (Mitte, gedreht). */
export function toLocal(p: Pick<Part, 'x' | 'y' | 'rot'>, wx: number, wy: number): [number, number] {
  const a = (-p.rot * Math.PI) / 180;
  const dx = wx - p.x;
  const dy = wy - p.y;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

/** Ecken-Griff: Breite und Tiefe folgen dem Finger (Mitte bleibt). Mit `lock` wächst alles im gleichen Verhältnis. */
export function resizeFromGround(start: Part, grab: [number, number], now: [number, number], lock: boolean): Part {
  const [lx0, ly0] = toLocal(start, grab[0], grab[1]);
  const [lx1, ly1] = toLocal(start, now[0], now[1]);
  const w = start.w + 2 * (lx1 - lx0);
  const d = start.d + 2 * (ly1 - ly0);
  if (lock) {
    const f = limitFactor(start, (w / start.w + d / start.d) / 2);
    return withSize(start, start.w * f, start.d * f, start.h * f);
  }
  return withSize(start, w, d, start.h);
}

/**
 * Höhen-Griff: die Höhe ändert sich um dz.
 * Mit `lock` wächst alles im gleichen Verhältnis; der Faktor richtet sich nach dem größten Maß,
 * damit flache Körper (z. B. der Ring) nicht bei kleinem Ziehen riesig werden.
 */
export function resizeHeight(start: Part, dz: number, lock: boolean): Part {
  if (lock) {
    const f = limitFactor(start, 1 + dz / Math.max(start.w, start.d, start.h));
    return withSize(start, start.w * f, start.d * f, start.h * f);
  }
  return withSize(start, start.w, start.d, Math.max(MIN_SIZE, start.h + dz));
}

/** Dreh-Griff: der Körper dreht sich um den Winkel, den der Finger um die Mitte zurückgelegt hat (rastet auf `snapDeg` ein). */
export function rotateFromGround(start: Part, grab: [number, number], now: [number, number], snapDeg = 5): Part {
  const a0 = Math.atan2(grab[1] - start.y, grab[0] - start.x);
  const a1 = Math.atan2(now[1] - start.y, now[0] - start.x);
  const deg = start.rot + ((a1 - a0) * 180) / Math.PI;
  return { ...start, rot: normalizeRot(snapDeg > 0 ? Math.round(deg / snapDeg) * snapDeg : deg) };
}

/** Stelle, an der der Anheben-Griff sitzt: links neben der Seitenwand, `extra` mm davon entfernt (Weltkoordinaten x, y). */
export function liftHandleXY(p: Pick<Part, 'x' | 'y' | 'rot' | 'w'>, extra = 0): [number, number] {
  const a = (p.rot * Math.PI) / 180;
  const r = p.w / 2 + extra;
  return [p.x - r * Math.cos(a), p.y - r * Math.sin(a)];
}

/**
 * Anheben-Griff: der Körper wandert um dz nach oben/unten (ganze mm, nie unter das Bett, nie über die Bauhöhe).
 * In der Nähe der Fläche, auf der er aufliegen würde (`support`), rastet er dort ein.
 */
export function liftZ(startZ: number, dz: number, height: number, support: number, bedHeight: number, snapMm = 2): number {
  let z = Math.round(startZ + dz);
  z = Math.min(Math.max(0, bedHeight - height), Math.max(0, z));
  if (Math.abs(z - support) <= snapMm) z = support;
  return z;
}
