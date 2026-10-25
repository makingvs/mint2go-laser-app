// Datenmodell: Entwurf mit Elementen, alle Maße in Millimetern.
import { bbox, distToPolyline, featureSize, pointInShape, transformShape, type Ring, type Shape, type Transform } from './geometry';

export type Op = 'cut' | 'engrave' | 'fill';
export type Kind = 'shape' | 'text' | 'graphic' | 'free';

export interface El {
  id: string;
  kind: Kind;
  /** Form-ID, Grafik-ID oder Text */
  ref: string;
  /** Normierte Ringe, Bounding-Box = Einheitsquadrat um (0,0) */
  base: Shape;
  /** Offene Linie (nur Freihand, nur Schneiden/Gravieren) */
  open?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  op: Op;
}

/** Zeichenfläche: unendlich oder ein Werkstück mit Form und Maßen in mm (Ursprung oben links). */
export interface Surface {
  kind: 'free' | 'rect' | 'ellipse' | 'shape';
  /** 'free' | 'rect' | 'ellipse' | Form-ID | "lib:..." (eigener Umriss) */
  ref: string;
  w: number;
  h: number;
  /** Umriss auf das Einheitsquadrat normiert (nur bei kind 'shape') */
  base?: Shape;
}

export interface Design {
  id: string;
  created: number;
  updated: number;
  elements: El[];
  /** fehlt bei älteren Arbeiten: dann Rechteck in Standardgröße */
  surface?: Surface;
}

export interface Settings {
  plate: { width: number; height: number };
  colors: { cut: string; engrave: string; fill: string };
  minSize: number;
}

export const DEFAULT_SETTINGS: Settings = {
  plate: { width: 300, height: 200 },
  colors: { cut: '#FF0000', engrave: '#0000FF', fill: '#000000' },
  minSize: 3,
};

export const OPS: Op[] = ['cut', 'engrave', 'fill'];

let counter = 0;
export function newId(prefix = 'e'): string {
  counter++;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function createDesign(): Design {
  const now = Date.now();
  return { id: newId('d-'), created: now, updated: now, elements: [] };
}

/** Normiert Ringe auf das Einheitsquadrat und liefert das natürliche Seitenverhältnis. */
export function normalizeBase(rings: Shape): { base: Shape; aspect: number } {
  const b = bbox(rings);
  const bw = Math.max(b.maxX - b.minX, 1e-6);
  const bh = Math.max(b.maxY - b.minY, 1e-6);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const base = rings.map((r) => r.map(([x, y]) => [(x - cx) / bw, (y - cy) / bh] as [number, number]));
  return { base, aspect: bw / bh };
}

export interface NewElementOptions {
  kind: Kind;
  ref: string;
  rings: Shape;
  op: Op;
  /** Länge der längeren Seite in mm */
  size: number;
  x: number;
  y: number;
  open?: boolean;
  /** exakte Maße in mm (überschreibt size) */
  exact?: { w: number; h: number };
}

export function makeElement(o: NewElementOptions): El {
  const { base, aspect } = normalizeBase(o.rings);
  let w: number;
  let h: number;
  if (o.exact) {
    w = o.exact.w;
    h = o.exact.h;
  } else if (aspect >= 1) {
    w = o.size;
    h = o.size / aspect;
  } else {
    h = o.size;
    w = o.size * aspect;
  }
  return { id: newId(), kind: o.kind, ref: o.ref, base, open: o.open, x: o.x, y: o.y, w, h, rot: 0, op: o.op };
}

export const transformOf = (e: El): Transform => ({ x: e.x, y: e.y, w: e.w, h: e.h, rot: e.rot });

export function worldShape(e: El): Shape {
  return transformShape(e.base, transformOf(e));
}

/** Aus offenen Linien, die als Fläche graviert werden sollen, wird eine geschlossene Form. */
export function isOpenLine(e: El): boolean {
  return !!e.open && e.op !== 'fill';
}

/** Zu dünne Stellen? Nur für geschlossene Formen sinnvoll. */
export function isTooThin(e: El, minSize: number): boolean {
  if (isOpenLine(e)) return false;
  if (minSize <= 0) return false;
  return featureSize(worldShape(e)) < minSize;
}

/** Trefferprüfung: erst genaue Geometrie, dann (kulanter) das gedrehte Rechteck. */
export function hitTest(e: El, p: [number, number], tolerance: number): 'shape' | 'box' | null {
  const ws = worldShape(e);
  if (isOpenLine(e)) {
    for (const r of ws) if (distToPolyline(p, r, false) <= tolerance) return 'shape';
    return null;
  }
  if (pointInShape(p, ws)) return 'shape';
  for (const r of ws) if (distToPolyline(p, r, true) <= tolerance) return 'shape';
  const a = (-e.rot * Math.PI) / 180;
  const dx = p[0] - e.x;
  const dy = p[1] - e.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  if (Math.abs(lx) <= e.w / 2 && Math.abs(ly) <= e.h / 2) return 'box';
  return null;
}

/** Oberstes Element unter dem Punkt. */
export function pickElement(els: El[], p: [number, number], tolerance: number): El | null {
  for (let i = els.length - 1; i >= 0; i--) if (hitTest(els[i], p, tolerance) === 'shape') return els[i];
  for (let i = els.length - 1; i >= 0; i--) if (hitTest(els[i], p, tolerance) === 'box') return els[i];
  return null;
}

export function cloneElements(els: El[]): El[] {
  return JSON.parse(JSON.stringify(els)) as El[];
}

/** Rückgängig/Wiederholen über Schnappschüsse der Elementliste. */
export class History {
  private past: string[] = [];
  private future: string[] = [];
  private current: string;
  constructor(initial: El[], private readonly limit = 100) {
    this.current = JSON.stringify(initial);
  }
  /** Neuen Stand festhalten. Gibt false zurück, wenn sich nichts geändert hat. */
  commit(els: El[]): boolean {
    const s = JSON.stringify(els);
    if (s === this.current) return false;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = s;
    this.future = [];
    return true;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  undo(): El[] | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(this.current);
    this.current = prev;
    return JSON.parse(prev) as El[];
  }
  redo(): El[] | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.current);
    this.current = next;
    return JSON.parse(next) as El[];
  }
}

export type { Ring };
