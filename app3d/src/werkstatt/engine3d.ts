// 3D-Werkstatt: Schritte und automatische Prüfung der Ergebnisse (reine Logik, gut testbar).
// Aufbau wie die Laser-Werkstatt (src/guided/engine.ts), aber für Körper statt Zeichnungen.
import type { Bed } from '../bed';
import type { PartKind } from '../mesh';
import { partBounds, type DimField, type Part } from '../model3d';
import { supportHeight } from '../support';

/** Tasten/Felder im Editor, die der Coach hervorheben kann. */
export type Highlight =
  | 'body' | 'shapes' | 'draw' | 'text' | 'svg'
  | 'hole' | 'merge' | 'copy' | 'delete' | 'undo' | 'export'
  | 'tilt' | 'mirror' | 'align'
  | 'lock' | 'width' | 'depth' | 'height' | 'rot' | 'z' | 'view';

/** Fortschritt in einer Arbeit (Design.guide) */
export interface GuideState {
  project: number;
  step: number;
  done?: boolean;
}

/** Was der Editor dem Coach über den aktuellen Stand verrät. */
export interface Snapshot {
  parts: Part[];
  selected: Part | null;
  /** Der Export-Dialog wurde in dieser Sitzung geöffnet (Datei abgeschickt) */
  exported: boolean;
  bed: Bed;
}

export type Check = (s: Snapshot) => boolean;

/** Wohin ein neuer Körper kommt: frei auf dem Bett, oben auf den gewählten, in die Mitte des gewählten (auf Höhe von dessen Boden) oder daneben. */
export type Place = 'free' | 'on' | 'in' | 'beside';
interface At {
  place?: Place;
  /** Versatz in mm (Mitte des gewählten als Bezug) */
  dx?: number;
  dy?: number;
  dz?: number;
}

/** Lösungsweg eines Schritts als Aktionen (nicht in der Oberfläche sichtbar; tests/werkstatt.test.ts spielt damit jedes Projekt durch). */
export type HelpOp =
  | ({ op: 'add'; kind: PartKind | 'tube' | 'gear'; w?: number; d?: number; h?: number; teeth?: number; hole?: boolean } & At)
  | ({ op: 'shape'; id: string; longest?: number; h?: number; hole?: boolean } & At)
  | ({ op: 'text'; value: string; h?: number } & At)
  | { op: 'set'; field: DimField; value: number; lock?: boolean }
  | { op: 'tilt'; axis: 'x' | 'y'; deg: number }
  | { op: 'hole' }
  | { op: 'align' }
  | { op: 'merge' }
  | { op: 'copy'; dx?: number; dy?: number; dz?: number }
  | { op: 'mirror' }
  | { op: 'drop'; dx?: number; dy?: number }
  | { op: 'put'; x: number; y: number }
  | { op: 'select'; pick: 'hole' | 'last' | 'first' | 'biggest' | 'smallest' | string };

export interface Step {
  /** Emoji als großes Symbol */
  icon: string;
  title: string;
  /** kurze Anweisung in einfachen Sätzen (wird auch vorgelesen) */
  text: string;
  /** Hervorhebung im Editor */
  show?: Highlight[];
  /** Ergebnis stimmt → Schritt wird automatisch abgehakt. Ohne check: "Weiter" von Hand (Bastel-/Info-Schritt). */
  check?: Check;
  /** Hinweis, wenn fast richtig */
  hint?: (s: Snapshot) => string | null;
  /** Lösungsweg (nur für den automatischen Durchspiel-Test) */
  help?: HelpOp[];
  /** Warnung (rot) zu diesem Schritt */
  warn?: string;
}

export interface Project {
  n: number;
  lv: 1 | 2 | 3 | 4;
  title: string;
  /** Kurzbeschreibung */
  k: string;
  emoji: string;
  /** Schwierigkeit 1..5 */
  d: number;
  /** Bauzeit und Druckzeit (Richtwerte) */
  bau: string;
  druck: string;
  steps: Step[];
  /** Ideen zum Selbermachen */
  ich: string[];
  tip: string;
  pro: string;
  warn?: string;
  /** Übung: wird nicht abgeschickt */
  noSend?: boolean;
}

// ---------- Maße und Lage ----------
const cache = new WeakMap<Part, { min: [number, number, number]; max: [number, number, number] }>();
export function bounds(p: Part): { min: [number, number, number]; max: [number, number, number] } {
  let b = cache.get(p);
  if (!b) {
    b = partBounds(p);
    cache.set(p, b);
  }
  return b;
}
export const extent = (p: Part): [number, number, number] => {
  const b = bounds(p);
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
};
export const topOf = (p: Part): number => bounds(p).max[2];
export const bottomOf = (p: Part): number => bounds(p).min[2];
export const centerOf = (p: Part): [number, number] => {
  const b = bounds(p);
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
};
export const between = (v: number, lo: number, hi: number): boolean => v >= lo && v <= hi;

/** Überlappen sich zwei Körper in der Draufsicht (mit Toleranz in mm)? */
export function overlapXY(a: Part, b: Part, tol = 0): boolean {
  const x = bounds(a);
  const y = bounds(b);
  return x.min[0] <= y.max[0] + tol && y.min[0] <= x.max[0] + tol && x.min[1] <= y.max[1] + tol && y.min[1] <= x.max[1] + tol;
}
/** Berühren oder überlappen sich zwei Körper im Raum? */
export function touching(a: Part, b: Part, tol = 0.6): boolean {
  const x = bounds(a);
  const y = bounds(b);
  return [0, 1, 2].every((k) => x.min[k] <= y.max[k] + tol && y.min[k] <= x.max[k] + tol);
}
/** Liegt a mit seinem Boden auf der Oberseite von b? */
export const restsOn = (a: Part, b: Part, tol = 0.8): boolean => a !== b && overlapXY(a, b) && Math.abs(bottomOf(a) - topOf(b)) <= tol;
/** Mitte von a liegt (fast) über der Mitte von b */
export function centered(a: Part, b: Part, tol = 3): boolean {
  const [ax, ay] = centerOf(a);
  const [bx, by] = centerOf(b);
  return Math.hypot(ax - bx, ay - by) <= tol;
}
/** a liegt (fast) ganz im Umriss von b (Draufsicht) */
export function insideXY(a: Part, b: Part, tol = 0.6): boolean {
  const x = bounds(a);
  const y = bounds(b);
  return x.min[0] >= y.min[0] - tol && x.max[0] <= y.max[0] + tol && x.min[1] >= y.min[1] - tol && x.max[1] <= y.max[1] + tol;
}

// ---------- Auswahl von Körpern ----------
export type Pred = (p: Part) => boolean;
export const solid: Pred = (p) => !p.hole;
export const isHole: Pred = (p) => !!p.hole;
export const not = (a: Pred): Pred => (p) => !a(p);
export const and = (...ps: Pred[]): Pred => (p) => ps.every((q) => q(p));
export const or = (...ps: Pred[]): Pred => (p) => ps.some((q) => q(p));
/** Grundkörper dieser Art (auch nach dem Kippen: Herkunft in `tag`) */
export const kindIs = (...kinds: string[]): Pred => (p) => kinds.includes(p.kind) || (!!p.tag && kinds.includes(p.tag));
export const tagIs = (...tags: string[]): Pred => (p) => !!p.tag && tags.some((t) => p.tag === t || p.tag!.startsWith(`${t}:`));
export const isText = tagIs('text');
export const isSketch = tagIs('sketch');
export const isShape = tagIs('shape');
export const isTube = tagIs('tube');
export const isGear = tagIs('gear');
export const isMesh: Pred = (p) => p.kind === 'mesh';
export const BOX = kindIs('box');
export const SPHERE = kindIs('sphere');
export const CYL = kindIs('cylinder');
export const CONE = kindIs('cone');
export const ROOFS = kindIs('roof', 'pyramid', 'cone', 'dome');
/** Größe (Umgebungsquader) in x, y, z: Zahl = Soll mit Toleranz, undefined = egal */
export function sized(x: number | undefined, y: number | undefined, z: number | undefined, tol = 2): Pred {
  return (p) => {
    const e = extent(p);
    return (x === undefined || Math.abs(e[0] - x) <= tol) && (y === undefined || Math.abs(e[1] - y) <= tol) && (z === undefined || Math.abs(e[2] - z) <= tol);
  };
}
/** Grundfläche zwischen den Werten (in beliebiger Drehung: lange/kurze Seite) und Höhe zwischen den Werten */
export function footprint(longLo: number, longHi: number, shortLo: number, shortHi: number): Pred {
  return (p) => {
    const e = extent(p);
    const long = Math.max(e[0], e[1]);
    const short = Math.min(e[0], e[1]);
    return between(long, longLo, longHi) && between(short, shortLo, shortHi);
  };
}
export const tall = (lo: number, hi: number): Pred => (p) => between(extent(p)[2], lo, hi);
export const wide = (lo: number, hi: number): Pred => (p) => between(Math.max(extent(p)[0], extent(p)[1]), lo, hi);
export const thin = (maxThick: number): Pred => (p) => Math.min(extent(p)[0], extent(p)[1], extent(p)[2]) <= maxThick;
export const onBed: Pred = (p) => bottomOf(p) <= 0.6;
export const lifted = (mm: number): Pred => (p) => bottomOf(p) >= mm;

// ---------- Prüfungen ----------
export const has = (p: Pred, n = 1): Check => (s) => s.parts.filter(p).length >= n;
export const none = (p: Pred): Check => (s) => !s.parts.some(p);
export const allOf = (...cs: Check[]): Check => (s) => cs.every((c) => c(s));
export const anyOf = (...cs: Check[]): Check => (s) => cs.some((c) => c(s));
/** Es gibt a und b, die zueinander passen */
export const pair = (a: Pred, b: Pred, rel: (x: Part, y: Part) => boolean): Check => (s) => {
  const A = s.parts.filter(a);
  const B = s.parts.filter(b);
  return A.some((x) => B.some((y) => x !== y && rel(x, y)));
};
/** Alle a haben ein passendes b (und es gibt mindestens ein a) */
export const everyHas = (a: Pred, b: Pred, rel: (x: Part, y: Part) => boolean): Check => (s) => {
  const A = s.parts.filter(a);
  const B = s.parts.filter(b);
  return A.length > 0 && A.every((x) => B.some((y) => x !== y && rel(x, y)));
};
/** Alles Volle ist zu `n` Teil(en) verbunden (Vereinen) und es liegt nichts Loses mehr herum */
export const mergedInto = (n = 1): Check => (s) => {
  const v = s.parts.filter(solid);
  return v.length === n && v.every(isMesh) && !s.parts.some(isHole);
};
export const exportedCheck: Check = (s) => s.exported;
/** Druck-Regeln: höchstens 100 mm, nichts in der Luft, im Bauraum */
export function printRulesOk(s: Snapshot): boolean {
  const v = s.parts.filter(solid);
  if (!v.length) return false;
  return v.every((p) => {
    const e = extent(p);
    const b = bounds(p);
    const inBed = b.min[0] >= -s.bed.width / 2 - 0.1 && b.max[0] <= s.bed.width / 2 + 0.1 && b.min[1] >= -s.bed.depth / 2 - 0.1 && b.max[1] <= s.bed.depth / 2 + 0.1;
    const floating = p.z - supportHeight(p, v.filter((q) => q !== p), p) > 1.2;
    return Math.max(...e) <= 100.6 && inBed && !floating && bottomOf(p) >= -0.1;
  });
}

const fmt = (n: number): string => String(+n.toFixed(1)).replace('.', ',');

/** Hinweis für Maße: sagt, was beim passenden Körper noch nicht stimmt (Breite/Tiefe/Höhe, die längere bzw. kürzere Seite bei Grundflächen). */
export function dimsHint(pred: Pred, want: { x?: number; y?: number; z?: number }, tol = 2): (s: Snapshot) => string | null {
  return (s) => {
    const sel = s.selected && pred(s.selected) ? s.selected : s.parts.filter(pred)[0];
    if (!sel) return null;
    const e = extent(sel);
    const bad: string[] = [];
    if (want.x !== undefined && Math.abs(e[0] - want.x) > tol) bad.push(`Breite ${fmt(want.x)}`);
    if (want.y !== undefined && Math.abs(e[1] - want.y) > tol) bad.push(`Tiefe ${fmt(want.y)}`);
    if (want.z !== undefined && Math.abs(e[2] - want.z) > tol) bad.push(`Höhe ${fmt(want.z)}`);
    return bad.length ? `Noch nicht ganz: ${bad.join(', ')}.` : null;
  };
}

/** Erster Schritt, dessen Prüfung (noch) nicht stimmt; Schritte ohne Prüfung zählen als erledigt. */
export function firstOpenStep(p: Project, s: Snapshot): number {
  const i = p.steps.findIndex((st) => st.check && !st.check(s));
  return i < 0 ? p.steps.length - 1 : i;
}
