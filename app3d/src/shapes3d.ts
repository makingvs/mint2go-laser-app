// Umrisse für die Sonderformen Röhre und Zahnrad (Form wie in der Laser-App: Ringe, y nach unten, Einheit mm).
// Daraus macht makeOutlinePart einen Körper mit Höhe; Löcher (Rohr innen, Achsloch) sind innere Ringe.
import type { Pt, Ring, Shape } from '../../src/geometry';

const circle = (r: number, n = 48, cx = 0, cy = 0): Ring => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)] as Pt);

/** Röhre: Ring mit Außendurchmesser `diameter`; die Wand ist ein Sechstel des Radius (bei 24 mm: 2 mm). */
export function tubeShape(diameter: number): Shape {
  const r = diameter / 2;
  return [circle(r), circle(r - r / 6)];
}

export const GEAR_MODULE = 2.5; // mm je Zahn (Teilkreisdurchmesser = Zähne x Modul): alle Zahnräder greifen ineinander
export const GEAR_AXLE = 5.5; // Durchmesser des Achslochs in mm
export const MIN_TEETH = 8;
export const MAX_TEETH = 24;

/** Teilkreisdurchmesser (mm): zwei Zahnräder greifen, wenn ihre Mitten die Hälfte der Summe auseinander liegen. */
export const pitchDiameter = (teeth: number): number => teeth * GEAR_MODULE;

/** Zahnrad mit `teeth` Zähnen (Trapez-Zähne) und Achsloch. Außendurchmesser = (Zähne + 2) x Modul. */
export function gearShape(teeth: number): Shape {
  const m = GEAR_MODULE;
  const rp = (teeth * m) / 2;
  const rTip = rp + m;
  const rRoot = rp - 1.25 * m;
  const step = (2 * Math.PI) / teeth;
  // Zahnbreite am Kopf 0,25 pi m, am Fuß 0,5 pi m (gemessen entlang des Kreises) -> Lücken sind breiter als Zähne
  const tip = (0.125 * Math.PI * m) / rTip;
  const root = (0.25 * Math.PI * m) / rRoot;
  const outer: Ring = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [r, da] of [[rRoot, -root], [rTip, -tip], [rTip, tip], [rRoot, root]] as const) outer.push([r * Math.cos(a + da), r * Math.sin(a + da)]);
  }
  return [outer, circle(GEAR_AXLE / 2, 24)];
}
