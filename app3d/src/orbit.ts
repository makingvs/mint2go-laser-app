// Kamera um das Druckbett (reine Rechnung, ohne three.js -> testbar). z zeigt nach oben.
import type { Bed } from './bed';

export type Vec3 = [number, number, number];

export interface Orbit {
  yaw: number; // Drehung um die senkrechte Achse (rad); -π/2 = Blick von vorn
  pitch: number; // Höhenwinkel über dem Bett (rad)
  dist: number; // Abstand zum Zielpunkt (mm)
  target: Vec3; // Zielpunkt (Mitte der Ansicht)
}

export const FOV_DEG = 40;
export const MIN_PITCH = (5 * Math.PI) / 180;
export const MAX_PITCH = (89 * Math.PI) / 180;
export const MIN_DIST = 30;

const ROTATE_PER_PX = 0.008; // rad pro Pixel

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Abstand, bei dem das ganze Bett im Bild ist. */
export function fitDistance(bed: Bed): number {
  const r = (Math.hypot(bed.width, bed.depth) / 2) * 1.1;
  return r / Math.sin(((FOV_DEG / 2) * Math.PI) / 180);
}

export const maxDist = (bed: Bed): number => fitDistance(bed) * 4;

/** Startansicht: schräg von vorn auf das ganze Bett. */
export function defaultOrbit(bed: Bed): Orbit {
  return { yaw: -Math.PI / 2 + 0.55, pitch: (35 * Math.PI) / 180, dist: fitDistance(bed), target: [0, 0, Math.min(bed.height, 40) / 4] };
}

/** Kameraposition aus dem Zustand. */
export function cameraPosition(o: Orbit): Vec3 {
  const c = Math.cos(o.pitch);
  return [o.target[0] + o.dist * c * Math.cos(o.yaw), o.target[1] + o.dist * c * Math.sin(o.yaw), o.target[2] + o.dist * Math.sin(o.pitch)];
}

/** Ein Finger/Maus zieht (dx, dy in Pixeln): Ansicht drehen. */
export function orbitRotate(o: Orbit, dx: number, dy: number): Orbit {
  return { ...o, yaw: o.yaw - dx * ROTATE_PER_PX, pitch: clamp(o.pitch + dy * ROTATE_PER_PX, MIN_PITCH, MAX_PITCH) };
}

/** Zoomen: factor > 1 = größer (näher heran). */
export function orbitZoom(o: Orbit, factor: number, bed: Bed): Orbit {
  if (!(factor > 0) || !Number.isFinite(factor)) return o;
  return { ...o, dist: clamp(o.dist / factor, MIN_DIST, maxDist(bed)) };
}

/** Verschieben (zwei Finger ziehen): der Inhalt folgt den Fingern in der Bildebene des Betts. */
export function orbitPan(o: Orbit, dx: number, dy: number, viewportHeight: number, bed: Bed): Orbit {
  if (viewportHeight <= 0) return o;
  const k = (o.dist * 2 * Math.tan(((FOV_DEG / 2) * Math.PI) / 180)) / viewportHeight; // mm pro Pixel
  const s = Math.sin(o.yaw);
  const c = Math.cos(o.yaw);
  // rechts = (-sin, cos), zur Kamera hin = (cos, sin); der Inhalt folgt dem Finger -> Ziel wandert entgegengesetzt
  const tx = o.target[0] - (-s * dx + c * dy) * k;
  const ty = o.target[1] - (c * dx + s * dy) * k;
  return { ...o, target: [clamp(tx, -bed.width / 2, bed.width / 2), clamp(ty, -bed.depth / 2, bed.depth / 2), o.target[2]] };
}
