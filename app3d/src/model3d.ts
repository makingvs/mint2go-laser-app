// Körper auf dem Druckbett (reine Rechnung). Maße in mm, Koordinaten wie in bed.ts (Ursprung Mitte Bett, z oben).
import type { Shape } from '../../src/geometry';
import { fitsInBuildVolume, type Bed, type Box3 } from './bed';
import { normalizeOutline, outlineMesh } from './extrude';
import { KIND_SIZE, unitMesh, type PartKind, type TriMesh } from './mesh';

/** Umriss eines gezeichneten Körpers (normiert, siehe extrude.ts); die Nummer dient dem Zwischenspeicher. */
export interface Outline {
  id: string;
  rings: Shape;
}

export interface Part {
  id: string;
  /** Grundkörper oder 'extrude' = gezeichneter Umriss mit Höhe */
  kind: PartKind | 'extrude';
  outline?: Outline;
  x: number; // Mitte, mm
  y: number;
  z: number; // Abstand des Bodens zum Bett (0 = liegt auf dem Bett)
  w: number; // Größe in Richtung der eigenen x-Achse
  d: number; // ... y-Achse
  h: number; // Höhe
  rot: number; // Drehung um die senkrechte Achse in Grad (0 bis < 360)
}

export const MIN_SIZE = 2; // kleinste Kantenlänge (mm); darunter druckt kein Drucker sinnvoll
export const MAX_SIZE = 500;
export const SNAP = 1; // beim Ziehen auf ganze mm einrasten

export type DimField = 'w' | 'd' | 'h' | 'rot' | 'z';

let counter = 0;
export function newId(): string {
  counter += 1;
  return `p${Date.now().toString(36)}${counter.toString(36)}`;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;
export const snap = (v: number, step = SNAP): number => Math.round(v / step) * step;

export function normalizeRot(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return round1(r) >= 360 ? 0 : round1(r);
}

export function createPart(kind: PartKind, x = 0, y = 0): Part {
  const [w, d, h] = KIND_SIZE[kind];
  return { id: newId(), kind, x, y, z: 0, w, d, h, rot: 0 };
}

export type OutlineSize = { longest: number } | { scale: number };

/**
 * Körper aus einem gezeichneten Umriss (Form aus der Laser-App: y nach unten, beliebige Einheit).
 * `size`: längste Seite in mm oder mm pro Einheit. Die Größe wird auf das Bett begrenzt. null bei leerer Form.
 */
export function makeOutlinePart(source: Shape, size: OutlineSize, height: number, bed: Bed, x = 0, y = 0): Part | null {
  const n = normalizeOutline(source);
  if (!n) return null;
  let s = 'scale' in size ? size.scale : size.longest / Math.max(n.w, n.d);
  s = Math.max(s, MIN_SIZE / Math.min(n.w, n.d)); // dünnste Seite mindestens MIN_SIZE ...
  s = Math.min(s, (Math.min(bed.width, bed.depth) * 0.9) / Math.max(n.w, n.d)); // ... aber nie größer als das Bett
  return {
    id: newId(),
    kind: 'extrude',
    outline: { id: newId(), rings: n.outline },
    x,
    y,
    z: 0,
    w: round1(Math.max(MIN_SIZE, n.w * s)),
    d: round1(Math.max(MIN_SIZE, n.d * s)),
    h: round1(clamp(height, MIN_SIZE, Math.max(MIN_SIZE, bed.height))),
    rot: 0,
  };
}

/** Netz im Einheitsquader zu diesem Körper. */
export function meshOf(p: Part): TriMesh {
  return p.kind === 'extrude' && p.outline ? outlineMesh(p.outline.id, p.outline.rings) : unitMesh(p.kind === 'extrude' ? 'box' : p.kind);
}

/** Eckpunkte des Körpers im Raum (Netz skaliert, gedreht, verschoben). */
export function worldVertices(p: Part): number[] {
  const m = meshOf(p);
  const a = (p.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out = new Array<number>(m.pos.length);
  for (let i = 0; i < m.pos.length; i += 3) {
    const lx = m.pos[i] * p.w;
    const ly = m.pos[i + 1] * p.d;
    out[i] = p.x + lx * c - ly * s;
    out[i + 1] = p.y + lx * s + ly * c;
    out[i + 2] = p.z + m.pos[i + 2] * p.h;
  }
  return out;
}

export function partBounds(p: Part): Box3 {
  const v = worldVertices(p);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3)
    for (let k = 0; k < 3; k++) {
      if (v[i + k] < min[k]) min[k] = v[i + k];
      if (v[i + k] > max[k]) max[k] = v[i + k];
    }
  return { min, max };
}

export const isOutside = (p: Part, bed: Bed): boolean => !fitsInBuildVolume(partBounds(p), bed);

/** Maße begrenzen (gleichmäßig, damit das Seitenverhältnis erhalten bleibt, wenn `lock` gesetzt ist). */
function limitFactor(p: Pick<Part, 'w' | 'd' | 'h'>, f: number): number {
  const lo = MIN_SIZE / Math.min(p.w, p.d, p.h);
  const hi = MAX_SIZE / Math.max(p.w, p.d, p.h);
  return clamp(f, lo, hi);
}

/** Ein Maß ändern. Bei `lock` werden Breite, Tiefe und Höhe gemeinsam im gleichen Verhältnis geändert. */
export function applyDim(p: Part, field: DimField, value: number, lock: boolean, bed: Bed): Part {
  switch (field) {
    case 'rot':
      return { ...p, rot: normalizeRot(value) };
    case 'z':
      return { ...p, z: round1(clamp(value, 0, Math.max(0, bed.height - MIN_SIZE))) };
    default: {
      const old = p[field];
      if (lock) {
        const f = limitFactor(p, value / old);
        return { ...p, w: round1(p.w * f), d: round1(p.d * f), h: round1(p.h * f) };
      }
      return { ...p, [field]: round1(clamp(value, MIN_SIZE, MAX_SIZE)) };
    }
  }
}

/** Größe gleichmäßig oder frei auf neue Werte setzen (für das Ziehen an den Griffen). */
export function withSize(p: Part, w: number, d: number, h: number): Part {
  return { ...p, w: clamp(w, MIN_SIZE, MAX_SIZE), d: clamp(d, MIN_SIZE, MAX_SIZE), h: clamp(h, MIN_SIZE, MAX_SIZE) };
}

export { limitFactor };

/** Freier Platz für einen neuen Körper: so nah wie möglich an der Mitte, ohne Überlappung in der Draufsicht. */
export function findFreeSpot(what: PartKind | Part, parts: Part[], bed: Bed, gap = 4): { x: number; y: number } {
  const probe = typeof what === 'string' ? createPart(what) : { ...what, x: 0, y: 0, rot: 0 };
  const step = 10;
  const half = Math.max(probe.w, probe.d) / 2;
  const boxes = parts.map(partBounds);
  const candidates: { x: number; y: number; r: number }[] = [];
  const nx = Math.max(0, Math.floor((bed.width / 2 - half) / step));
  const ny = Math.max(0, Math.floor((bed.depth / 2 - half) / step));
  for (let i = -nx; i <= nx; i++)
    for (let j = -ny; j <= ny; j++) candidates.push({ x: i * step, y: j * step, r: Math.hypot(i, j) * step });
  candidates.sort((a, b) => a.r - b.r || a.y - b.y || a.x - b.x);
  for (const c of candidates) {
    const b = partBounds({ ...probe, x: c.x, y: c.y });
    const free = boxes.every((o) => b.max[0] + gap <= o.min[0] || b.min[0] - gap >= o.max[0] || b.max[1] + gap <= o.min[1] || b.min[1] - gap >= o.max[1]);
    if (free) return { x: c.x, y: c.y };
  }
  return { x: 0, y: 0 };
}

export const cloneParts = (parts: Part[]): Part[] => JSON.parse(JSON.stringify(parts)) as Part[];

/** Kopie, etwas versetzt, mit neuer Nummer. */
export function duplicatePart(p: Part, offset = 15): Part {
  return { ...p, id: newId(), x: p.x + offset, y: p.y - offset };
}

/** Körper in die Mitte des Betts setzen (z bleibt). */
export const centered = (p: Part): Part => ({ ...p, x: 0, y: 0 });
