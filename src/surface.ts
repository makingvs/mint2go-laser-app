// Zeichenfläche: unendlich oder Werkstück (Rechteck, Kreis/Oval, Form, eigener Umriss) mit Maßen in mm.
import { bbox, distToPolyline, pointInShape, transformShape, type BBox, type Pt, type Shape } from './geometry';
import { normalizeBase, worldShape, type Design, type El, type Settings, type Surface } from './model';
import { baseShape, type ShapeId } from './shapes';

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ausgangsbereich der unendlichen Fläche (mm) – wächst mit dem Inhalt. */
export const FREE_AREA = { w: 300, h: 200 };
export const MIN_SIDE = 10;
export const MAX_SIDE = 1000;

export const freeSurface = (): Surface => ({ kind: 'free', ref: 'free', w: 0, h: 0 });
export const rectSurface = (w: number, h: number): Surface => ({ kind: 'rect', ref: 'rect', w, h });
export const ellipseSurface = (w: number, h: number): Surface => ({ kind: 'ellipse', ref: 'ellipse', w, h });

/** Formen mit festem Umriss; Seitenverhältnis aus dem Umriss. */
export function shapeSurface(ref: string, rings: Shape, longest = 200): Surface {
  const { base, aspect } = normalizeBase(rings);
  const w = aspect >= 1 ? longest : longest * aspect;
  const h = aspect >= 1 ? longest / aspect : longest;
  return { kind: 'shape', ref, w, h, base };
}

export const builtinShapeSurface = (id: ShapeId, longest = 200): Surface => shapeSurface(id, baseShape(id), longest);

/** Standard für neue Arbeiten und ältere Arbeiten ohne Zeichenfläche. */
export const defaultSurface = (s: Pick<Settings, 'plate'>): Surface => rectSurface(s.plate.width, s.plate.height);

export const isFree = (s: Surface): boolean => s.kind === 'free';

export function surfaceBase(s: Surface): Shape {
  if (s.kind === 'rect') return [[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]];
  if (s.kind === 'ellipse') return normalizeBase(baseShape('circle')).base;
  return s.base ?? [];
}

/** Umriss in Weltkoordinaten (Ursprung oben links, Kasten 0..w × 0..h). */
export function surfaceShape(s: Surface): Shape {
  if (isFree(s)) return [];
  return transformShape(surfaceBase(s), { x: s.w / 2, y: s.h / 2, w: s.w, h: s.h, rot: 0 });
}

/** Größe für Standardmaße neuer Teile (bei unendlich: Ausgangsbereich). */
export const surfaceSize = (s: Surface): { w: number; h: number } => (isFree(s) ? FREE_AREA : { w: s.w, h: s.h });

export const surfaceKey = (s: Surface): string => `${s.kind}|${s.ref}|${s.w.toFixed(1)}|${s.h.toFixed(1)}`;

/** Prüft/begrenzt eine geladene Zeichenfläche. */
export function normalizeSurface(input: unknown, fallback: Surface): Surface {
  const s = input as Partial<Surface> | undefined;
  if (!s || typeof s !== 'object') return fallback;
  if (s.kind === 'free') return freeSurface();
  const clamp = (v: unknown) => Math.min(MAX_SIDE, Math.max(MIN_SIDE, Number(v)));
  const w = clamp(s.w);
  const h = clamp(s.h);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return fallback;
  if (s.kind === 'rect') return rectSurface(w, h);
  if (s.kind === 'ellipse') return ellipseSurface(w, h);
  if (s.kind === 'shape' && Array.isArray(s.base) && s.base.length) return { kind: 'shape', ref: String(s.ref ?? 'shape'), w, h, base: s.base };
  return fallback;
}

/** Sichtbereich bei fester Fläche: Fläche plus Rand, damit Überstehendes sichtbar bleibt. */
export function fixedView(s: Surface): View {
  const m = Math.max(10, Math.max(s.w, s.h) * 0.06);
  return { x: -m, y: -m, w: s.w + 2 * m, h: s.h + 2 * m };
}

export function contentBounds(els: El[]): BBox | null {
  const rings = els.flatMap((e) => worldShape(e));
  return rings.length ? bbox(rings) : null;
}

/** Sichtbereich der unendlichen Fläche: wächst mit dem Inhalt, schrumpft nie (ruhige Ansicht). */
export function growView(prev: View | null, els: El[]): View {
  const b = contentBounds(els);
  let minX = 0;
  let minY = 0;
  let maxX = FREE_AREA.w;
  let maxY = FREE_AREA.h;
  if (b) {
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const pad = Math.max(10, Math.max(maxX - minX, maxY - minY) * 0.1);
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  if (prev) {
    minX = Math.min(minX, prev.x);
    minY = Math.min(minY, prev.y);
    maxX = Math.max(maxX, prev.x + prev.w);
    maxY = Math.max(maxY, prev.y + prev.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const MAX_ZOOM = 8;

/** Ausschnitt bei Zoom: gleicher Mittelpunkt, 1/zoom der Breite/Höhe, bleibt innerhalb der Gesamtansicht. */
export function zoomedView(base: View, zoom: number, center?: Pt | null): View {
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
  if (z === 1) return base;
  const w = base.w / z;
  const h = base.h / z;
  const cx = Math.min(base.x + base.w - w / 2, Math.max(base.x + w / 2, center ? center[0] : base.x + base.w / 2));
  const cy = Math.min(base.y + base.h - h / 2, Math.max(base.y + h / 2, center ? center[1] : base.y + base.h / 2));
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function viewFor(s: Surface, els: El[], prev: View | null): View {
  return isFree(s) ? growView(prev, els) : fixedView(s);
}

/** Rahmen der exportierten SVG: Werkstückgröße, bei unendlicher Fläche der Inhalt (nach links oben verschoben). */
export function exportFrame(design: Pick<Design, 'elements' | 'surface'>, settings: Pick<Settings, 'plate'>): { w: number; h: number; dx: number; dy: number } {
  const s = design.surface ?? defaultSurface(settings);
  if (!isFree(s)) return { w: s.w, h: s.h, dx: 0, dy: 0 };
  const b = contentBounds(design.elements);
  if (!b) return { w: settings.plate.width, h: settings.plate.height, dx: 0, dy: 0 };
  return { w: Math.max(b.maxX - b.minX, 0.1), h: Math.max(b.maxY - b.minY, 0.1), dx: -b.minX, dy: -b.minY };
}

/** Steht das Teil (teilweise) über das Werkstück hinaus? Bei unendlicher Fläche nie. */
export function isOutside(e: El, s: Surface, tolerance = 0.3): boolean {
  if (isFree(s)) return false;
  const outline = surfaceShape(s);
  for (const ring of worldShape(e)) {
    for (const p of ring) {
      if (pointInShape(p, outline)) continue;
      let d = Infinity;
      for (const r of outline) d = Math.min(d, distToPolyline(p, r, true));
      if (d > tolerance) return true;
    }
  }
  return false;
}
