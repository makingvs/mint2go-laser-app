// Geführter Modus: Schritte, automatische Prüfung der Ergebnisse (reine Logik, gut testbar).
import type { El, Op, Surface } from '../model';
import { worldShape } from '../model';
import { bbox } from '../geometry';

/** Tasten/Felder im Editor, die der Coach hervorheben kann. */
export type Highlight =
  | 'shapes' | 'draw' | 'image' | 'svg' | 'search' | 'text' | 'surface' | 'export'
  | 'cut' | 'engrave' | 'fill' | 'width' | 'height' | 'lock' | 'font' | 'center' | 'zoom' | 'undo';

/** Was der Editor dem Coach über den aktuellen Stand verrät. */
export interface Snapshot {
  elements: El[];
  selected: El | null;
  surface: Surface;
  /** Datei wurde in dieser Sitzung exportiert */
  exported: boolean;
  /** zu dünne Stellen (Warndreieck) */
  thin: (e: El) => boolean;
  /** ragt über das Werkstück hinaus */
  outside: (e: El) => boolean;
}

export type Check = (s: Snapshot) => boolean;

export interface Step {
  /** Emoji als Symbol */
  icon: string;
  title: string;
  /** kurze Anweisung für Kinder */
  text: string;
  /** Hervorhebung im Editor */
  show?: Highlight[];
  /** Ergebnis stimmt → Schritt wird automatisch abgehakt. Ohne check: "Weiter" von Hand (Info-/Bastelschritt). */
  check?: Check;
  /** Hinweis, wenn fast richtig (z. B. Maße noch nicht erreicht) */
  hint?: (s: Snapshot) => string | null;
  /** Hilfe-Taste: Vorlage laden oder Zeichenfläche für mich einstellen */
  action?: 'template' | 'surface';
  /** Warnung (rot) zu diesem Schritt */
  warn?: string;
}

// ---------- Auswahl von Teilen ----------
export type Pred = (e: El) => boolean;

export const isShape = (...ids: string[]): Pred => (e) => e.kind === 'shape' && ids.includes(e.ref);
export const isText: Pred = (e) => e.kind === 'text';
export const isFree: Pred = (e) => e.kind === 'free';
export const isOpenLine: Pred = (e) => e.kind === 'free' && !!e.open;
export const isFreeClosed: Pred = (e) => e.kind === 'free' && !e.open;
export const isFound: Pred = (e) => e.kind === 'graphic' && e.ref.startsWith('iconify:');
export const isUpload: Pred = (e) => e.kind === 'graphic' && e.ref.startsWith('upload:');
export const isPhoto: Pred = (e) => e.kind === 'graphic' && e.ref === 'upload:bild';
export const isTemplate: Pred = (e) => e.kind === 'graphic' && e.ref.startsWith('template:');
export const isAnyImage: Pred = (e) => e.kind === 'graphic';
export const not = (p: Pred): Pred => (e) => !p(e);
export const or = (...ps: Pred[]): Pred => (e) => ps.some((p) => p(e));
export const and = (...ps: Pred[]): Pred => (e) => ps.every((p) => p(e));
/** Teil mit Maßen (Toleranz in mm); h weglassen = nur Breite prüfen */
export const hasDims = (w?: number, h?: number, tol = 1.2): Pred => (e) =>
  (w === undefined || Math.abs(e.w - w) <= tol) && (h === undefined || Math.abs(e.h - h) <= tol);
/** Teil höchstens so groß */
export const maxSide = (mm: number): Pred => (e) => Math.max(e.w, e.h) <= mm + 0.6;
export const minSide = (mm: number): Pred => (e) => Math.min(e.w, e.h) >= mm - 0.6;
export const smallerThan = (mm: number): Pred => (e) => Math.max(e.w, e.h) < mm;

// ---------- Prüfungen ----------
export const has = (p: Pred, n = 1): Check => (s) => s.elements.filter(p).length >= n;
export const hasAll = (...cs: Check[]): Check => (s) => cs.every((c) => c(s));
export const hasAny = (...cs: Check[]): Check => (s) => cs.some((c) => c(s));
/** alle passenden Teile haben diese Bearbeitungsart (und es gibt mindestens eines) */
export const opIs = (p: Pred, op: Op): Check => (s) => {
  const m = s.elements.filter(p);
  return m.length > 0 && m.every((e) => e.op === op);
};
export const surfaceIs = (kind: Surface['kind'], w?: number, h?: number, tol = 1): Check => (s) =>
  s.surface.kind === kind && (w === undefined || Math.abs(s.surface.w - w) <= tol) && (h === undefined || Math.abs(s.surface.h - h) <= tol);
export const surfaceWidthBetween = (lo: number, hi: number): Check => (s) => s.surface.kind !== 'free' && s.surface.w >= lo && s.surface.w <= hi;
export const exportedCheck: Check = (s) => s.exported;
/** kein Warnzeichen "zu dünn" */
export const noThin: Check = (s) => s.elements.length > 0 && !s.elements.some((e) => s.thin(e));
/** nichts ragt über das Werkstück hinaus */
export const allInside: Check = (s) => s.elements.length > 0 && !s.elements.some((e) => s.outside(e));
/** Mittelpunkt von a liegt (fast) im Mittelpunkt von b */
export const centeredOn = (a: Pred, b: Pred, tol = 8): Check => (s) => {
  const A = s.elements.filter(a);
  const B = s.elements.filter(b);
  return A.length > 0 && B.length > 0 && A.every((x) => B.some((y) => Math.hypot(x.x - y.x, x.y - y.y) <= tol));
};
/** Teil a liegt vollständig im Umriss (Kasten) von Teil b */
export const insideOf = (a: Pred, b: Pred): Check => (s) => {
  const A = s.elements.filter(a);
  const B = s.elements.filter(b);
  return (
    A.length > 0 &&
    B.length > 0 &&
    A.every((x) => {
      const bx = bbox(worldShape(x));
      return B.some((y) => {
        const by = bbox(worldShape(y));
        return bx.minX >= by.minX - 0.5 && bx.maxX <= by.maxX + 0.5 && bx.minY >= by.minY - 0.5 && bx.maxY <= by.maxY + 0.5;
      });
    })
  );
};
/** mindestens n Teile, die voneinander verschieden große Maße haben (Muster mit großen und kleinen Formen) */
export const mixedSizes = (p: Pred, n: number): Check => (s) => {
  const m = s.elements.filter(p);
  if (m.length < n) return false;
  const sizes = m.map((e) => Math.max(e.w, e.h));
  return Math.max(...sizes) / Math.max(Math.min(...sizes), 0.1) >= 1.6;
};
/** n Teile gleich groß (Zwillings-Teile) */
export const twins = (p: Pred, n = 2, tol = 0.6): Check => (s) => {
  const m = s.elements.filter(p);
  return m.some((a) => m.filter((b) => Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol).length >= n);
};

const fmt = (n: number) => String(+n.toFixed(1)).replace('.', ',');

/** Hinweis "fast richtig": passendes Teil vorhanden, aber falsche Maße. */
export const dimsHint = (p: Pred, w?: number, h?: number): ((s: Snapshot) => string | null) => (s) => {
  const e = s.selected && p(s.selected) ? s.selected : s.elements.filter(p).pop();
  if (!e) return null;
  const goal = [w !== undefined ? `Breite ${fmt(w)}` : '', h !== undefined ? `Höhe ${fmt(h)}` : ''].filter(Boolean).join(' und ');
  const ok = (w === undefined || Math.abs(e.w - w) <= 1.2) && (h === undefined || Math.abs(e.h - h) <= 1.2);
  return ok ? null : `Jetzt: Breite ${fmt(e.w)} mm, Höhe ${fmt(e.h)} mm. Gesucht: ${goal} mm.`;
};

export interface Project {
  n: number;
  /** 1 Starter · 2 Gravur-Profi · 3 Schneide-Meister · 4 Erfinder */
  lv: 1 | 2 | 3 | 4;
  title: string;
  /** Kurztext */
  k: string;
  /** Material (Schlüssel für Symbol/Name) */
  mat: string;
  /** Schwierigkeit 1–5 */
  d: number;
  bau: string;
  laser: string;
  warn?: string;
  /** Zeichenfläche beim Start */
  surface?: { kind: 'rect' | 'ellipse'; w: number; h: number };
  /** Vorlage (SVG in mm) */
  template?: string;
  steps: Step[];
  /** Ideen */
  ich: string[];
  /** Profi-Wissen */
  pro: string;
  tip: string;
  /** Laser-Einstellungen für die Lehrperson */
  lp: { m: string; hw?: string; e: [string, string, string, string][] };
}

/** Lauffähiger Fortschritt eines geführten Projekts (wird in der Arbeit gespeichert). */
export interface GuideState {
  project: number;
  step: number;
  done?: boolean;
}

/** Index des ersten Schritts, dessen Prüfung noch nicht erfüllt ist (für "wo war ich"). */
export function firstOpenStep(p: Project, s: Snapshot): number {
  for (let i = 0; i < p.steps.length; i++) {
    const c = p.steps[i].check;
    if (c && !c(s)) return i;
    if (!c) return Math.min(i, p.steps.length - 1);
  }
  return p.steps.length - 1;
}
