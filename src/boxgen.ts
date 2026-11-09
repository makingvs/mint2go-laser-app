// Box-Generator: Steckbox mit Fingerzinken für den Laser (xTool S1, 40 W), Schnittbreite (Kerf) ausgeglichen.
// Reine Logik ohne Oberfläche. Koordinaten der Teile: u nach rechts, v nach oben (Millimeter).
import { GLYPH_HEIGHT, textShape } from './text';

export type Pt = [number, number];

/** Arbeitsfläche des xTool S1 (mm) */
export const S1_BED = { w: 498, h: 319 };

export type LidKind = 'none' | 'loose' | 'fingers';

export interface BoxParams {
  /** Maße der Box (mm); gelten innen oder außen */
  w: number;
  d: number;
  h: number;
  inner: boolean;
  /** Materialdicke in mm (nachmessen!) */
  thickness: number;
  lid: LidKind;
  /** gewünschte Zinkenbreite in mm */
  finger: number;
  /** Schnittbreite des Lasers in mm: der Strahl nimmt so viel Material weg */
  kerf: number;
  /** Passung in mm: > 0 lockerer, < 0 strammer */
  fit: number;
}

/**
 * Startwerte. Die Schnittbreite des xTool S1 (40 W) auf 3-mm-Pappelsperrholz ist nicht veröffentlicht;
 * 0,15 mm ist ein üblicher Wert für Diodenlaser und wird mit der Passprobe nachgemessen.
 */
export const BOX_DEFAULTS: BoxParams = { w: 80, d: 60, h: 40, inner: true, thickness: 3, lid: 'loose', finger: 10, kerf: 0.15, fit: 0.05 };

export interface Panel {
  id: 'front' | 'back' | 'left' | 'right' | 'bottom' | 'top' | 'lid';
  label: string;
  /** Maße des Rechtecks, in dem das Teil liegt */
  a: number;
  b: number;
  /** Umriss nach Zeichnung (ohne Schnittbreiten-Ausgleich) */
  nominal: Pt[];
  /** Umriss zum Schneiden: um (Schnittbreite − Passung) / 2 nach außen versetzt */
  cut: Pt[];
}

export type BoxResult = { ok: true; panels: Panel[]; outer: { w: number; d: number; h: number }; wallHeight: number } | { ok: false; error: string };

// ---------- Kanten ----------
/** Verlauf einer Kante: je Abschnitt rec = 0 (Teil reicht bis zum Rand) oder t (zurückgesetzt, hier greift das Nachbarteil) */
export interface Edge {
  bounds: number[];
  rec: number[];
}

const flat = (len: number): Edge => ({ bounds: [0, len], rec: [0] });

/** n gleiche Abschnitte (n ungerade); ownsEnds: dieses Teil besitzt Abschnitt 0, 2, 4 … (also auch die Enden) */
export function pattern(len: number, n: number, t: number, ownsEnds: boolean): Edge {
  const bounds = Array.from({ length: n + 1 }, (_, i) => (len * i) / n);
  const rec = Array.from({ length: n }, (_, i) => ((i % 2 === 0) === ownsEnds ? 0 : t));
  return { bounds, rec };
}

/** Kante, deren beide Eck-Würfel (Länge t) einem dritten Teil gehören; dazwischen m Abschnitte (m ungerade) */
export function cubeEdge(len: number, t: number, m: number, ownsFirst: boolean): Edge {
  const inner = len - 2 * t;
  const bounds = [0, t, ...Array.from({ length: m }, (_, i) => t + (inner * (i + 1)) / m)];
  bounds[bounds.length - 1] = len - t;
  bounds.push(len);
  const rec = [t, ...Array.from({ length: m }, (_, i) => ((i % 2 === 0) === ownsFirst ? 0 : t)), t];
  return { bounds, rec };
}

/** Anzahl der Zinken (ungerade) für eine Kantenlänge; null, wenn die Kante zu kurz ist */
export function fingerCount(len: number, target: number, minFinger: number, minCount = 3): number | null {
  let n = Math.max(minCount, Math.round(len / target));
  if (n % 2 === 0) n += Math.abs(len / (n - 1) - target) < Math.abs(len / (n + 1) - target) && n - 1 >= minCount ? -1 : 1;
  while (n > minCount && len / n < minFinger) n -= 2;
  return len / n >= minFinger - 1e-9 ? n : null;
}

// ---------- Umriss eines Teils ----------
const same = (p: Pt, q: Pt) => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;

/** doppelte und auf einer Linie liegende Punkte entfernen */
export function tidy(pts: Pt[]): Pt[] {
  let out = pts.filter((p, i) => !same(p, pts[(i + pts.length - 1) % pts.length]));
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const p = out[(i + out.length - 1) % out.length];
      const c = out[i];
      const n = out[(i + 1) % out.length];
      const cross = (c[0] - p[0]) * (n[1] - c[1]) - (c[1] - p[1]) * (n[0] - c[0]);
      if (Math.abs(cross) < 1e-9) {
        out = out.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return out;
}

/** Rechteck a × b, dessen vier Kanten die angegebenen Verläufe haben (alle in aufsteigender Richtung gespeichert) */
export function panelOutline(a: number, b: number, e: { bottom: Edge; right: Edge; top: Edge; left: Edge }): Pt[] {
  const { bottom, right, top, left } = e;
  const last = (x: Edge) => x.rec.length - 1;
  const cbl: Pt = [left.rec[0], bottom.rec[0]];
  const cbr: Pt = [a - right.rec[0], bottom.rec[last(bottom)]];
  const ctr: Pt = [a - right.rec[last(right)], b - top.rec[last(top)]];
  const ctl: Pt = [left.rec[last(left)], b - top.rec[0]];
  const pts: Pt[] = [cbl];
  for (let k = 1; k < bottom.rec.length; k++) pts.push([bottom.bounds[k], bottom.rec[k - 1]], [bottom.bounds[k], bottom.rec[k]]);
  pts.push(cbr);
  for (let k = 1; k < right.rec.length; k++) pts.push([a - right.rec[k - 1], right.bounds[k]], [a - right.rec[k], right.bounds[k]]);
  pts.push(ctr);
  for (let k = top.rec.length - 1; k >= 1; k--) pts.push([top.bounds[k], b - top.rec[k]], [top.bounds[k], b - top.rec[k - 1]]);
  pts.push(ctl);
  for (let k = left.rec.length - 1; k >= 1; k--) pts.push([left.rec[k], left.bounds[k]], [left.rec[k - 1], left.bounds[k]]);
  return tidy(pts);
}

/** Fläche (positiv bei Gegenuhrzeigersinn) */
export function area(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

/** Umriss mit lauter rechten Winkeln um d nach außen versetzt (d < 0: nach innen) */
export function offsetRectilinear(pts: Pt[], d: number): Pt[] {
  if (d === 0) return pts.map((p) => [p[0], p[1]] as Pt);
  const sign = area(pts) >= 0 ? 1 : -1;
  const n = pts.length;
  const normal = (p: Pt, q: Pt): Pt => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    return [(sign * dy) / len, (-sign * dx) / len];
  };
  return pts.map((p, i) => {
    const n1 = normal(pts[(i + n - 1) % n], p);
    const n2 = normal(p, pts[(i + 1) % n]);
    return [p[0] + d * (n1[0] + n2[0]), p[1] + d * (n1[1] + n2[1])] as Pt;
  });
}

const rect = (a: number, b: number): Pt[] => [[0, 0], [a, 0], [a, b], [0, b]];

// ---------- die Box ----------
export function boxPanels(p: BoxParams): BoxResult {
  const t = p.thickness;
  if (!(t >= 1 && t <= 10)) return { ok: false, error: 'Materialdicke 1–10 mm' };
  const minFinger = Math.max(1.5 * t, 4);
  const target = Math.max(p.finger, minFinger);
  const t2 = 2 * t;
  const closed = p.lid === 'fingers';
  // Außenmaße; Wandhöhe = Höhe ohne aufliegenden Deckel
  let W: number;
  let D: number;
  let Hout: number;
  if (p.inner) {
    W = p.w + t2;
    D = p.d + t2;
    Hout = p.h + (p.lid === 'none' ? t : t2);
  } else {
    W = p.w;
    D = p.d;
    Hout = p.h;
  }
  const Hw = p.lid === 'loose' ? Hout - t : Hout;
  if (W < 4 * minFinger || D < 2 * t + minFinger + 2 * t || Hw < 3 * minFinger) return { ok: false, error: 'Zu klein für Zinken – bitte größer' };
  const nx = fingerCount(W, target, minFinger);
  const nz = fingerCount(Hw, target, minFinger);
  const ny = fingerCount(D - t2, target, minFinger, 1);
  if (nx === null || nz === null || ny === null) return { ok: false, error: 'Zu klein für Zinken – bitte größer' };

  const vertF = pattern(Hw, nz, t, true); // vorne/hinten besitzen die Enden
  const vertL = pattern(Hw, nz, t, false);
  const topF = closed ? pattern(W, nx, t, true) : flat(W);
  const edgeX = (own: boolean) => pattern(W, nx, t, own);
  const side = (own: boolean) => cubeEdge(D, t, ny, own);
  const topSide = closed ? side(true) : flat(D);

  const make = (id: Panel['id'], label: string, a: number, b: number, e: { bottom: Edge; right: Edge; top: Edge; left: Edge } | null): Panel => {
    const nominal = e ? panelOutline(a, b, e) : rect(a, b);
    return { id, label, a, b, nominal, cut: offsetRectilinear(nominal, (p.kerf - p.fit) / 2) };
  };
  const panels: Panel[] = [
    make('front', 'Vorne', W, Hw, { bottom: edgeX(true), right: vertF, top: topF, left: vertF }),
    make('back', 'Hinten', W, Hw, { bottom: edgeX(true), right: vertF, top: topF, left: vertF }),
    make('left', 'Links', D, Hw, { bottom: side(true), right: vertL, top: topSide, left: vertL }),
    make('right', 'Rechts', D, Hw, { bottom: side(true), right: vertL, top: topSide, left: vertL }),
    make('bottom', 'Boden', W, D, { bottom: edgeX(false), right: side(false), top: edgeX(false), left: side(false) }),
  ];
  if (closed) panels.push(make('top', 'Deckel', W, D, { bottom: edgeX(false), right: side(false), top: edgeX(false), left: side(false) }));
  else if (p.lid === 'loose') panels.push(make('lid', 'Deckel', W, D, null));
  return { ok: true, panels, outer: { w: W, d: D, h: Hout }, wallHeight: Hw };
}

// ---------- Anordnung auf der Platte ----------
export interface Placed {
  panel: Panel;
  /** Umriss zum Schneiden in Plattenkoordinaten (y nach unten, Ursprung oben links) */
  ring: Pt[];
  x: number;
  y: number;
}

/** Teile zeilenweise nebeneinander legen. maxW = verfügbare Breite; gap = Abstand zwischen den Teilen. */
export function layout(panels: Panel[], maxW: number, gap: number, margin = 5): { placed: Placed[]; w: number; h: number } {
  const list = [...panels].sort((p, q) => q.b - p.b || q.a - p.a);
  const placed: Placed[] = [];
  let x = margin;
  let y = margin;
  let rowH = 0;
  let usedW = 0;
  for (const panel of list) {
    const pad = Math.max(0, panel.cut.reduce((m, q) => Math.max(m, -q[0], q[0] - panel.a, -q[1], q[1] - panel.b), 0));
    const pw = panel.a + 2 * pad;
    const ph = panel.b + 2 * pad;
    if (x > margin && x + pw > maxW - margin) {
      x = margin;
      y += rowH + gap;
      rowH = 0;
    }
    // y nach unten: v wird gespiegelt
    const ring = panel.cut.map((q) => [x + pad + q[0], y + pad + (panel.b - q[1])] as Pt);
    placed.push({ panel, ring, x: x + pad, y: y + pad });
    x += pw + gap;
    rowH = Math.max(rowH, ph);
    usedW = Math.max(usedW, x - gap);
  }
  return { placed, w: usedW + margin, h: y + rowH + margin };
}

/** Passt die Anordnung auf die Arbeitsfläche des S1? (auch gedreht) */
export const fitsBed = (w: number, h: number): boolean => (w <= S1_BED.w && h <= S1_BED.h) || (w <= S1_BED.h && h <= S1_BED.w);

// ---------- Passprobe ----------
/** Kleine Probe-Paare mit unterschiedlicher Schnittbreite, um die richtige für das eigene Gerät/Material zu finden. */
export function fitTestParts(thickness: number, kerfs: number[], fit: number): { panels: Panel[]; kerfOf: number[] } {
  const t = thickness;
  const a = Math.max(5 * Math.max(1.5 * t, 4), 24);
  const b = 16 + t;
  const panels: Panel[] = [];
  const kerfOf: number[] = [];
  for (const k of kerfs) {
    for (const own of [true, false]) {
      const nominal = panelOutline(a, b, { bottom: pattern(a, 5, t, own), right: flat(b), top: flat(a), left: flat(b) });
      panels.push({ id: 'front', label: own ? 'Probe A' : 'Probe B', a, b, nominal, cut: offsetRectilinear(nominal, (k - fit) / 2) });
      kerfOf.push(k);
    }
  }
  return { panels, kerfOf };
}

export interface SheetPart {
  /** ein Teil kann mehrere Ringe haben (Zahlen mit Loch) */
  rings: Pt[][];
  op: 'cut' | 'fill';
  ref: string;
}

/** Passprobe als fertiges Blatt: je Schnittbreite ein Paar (A, B) und daneben die Zahl in Hundertstel-mm (15 = 0,15 mm). */
export function fitTestSheet(thickness: number, kerfs: number[], fit: number, margin = 5, gap = 6): { parts: SheetPart[]; w: number; h: number } {
  const { panels, kerfOf } = fitTestParts(thickness, kerfs, fit);
  const a = panels[0].a;
  const b = panels[0].b;
  const pad = Math.max(0, ...panels.map((p) => p.cut.reduce((m, q) => Math.max(m, -q[0], q[0] - p.a, -q[1], q[1] - p.b), 0)));
  const textH = Math.min(16, b - 2); // groß genug, damit die Striche nicht als "zu dünn" gelten
  const k = textH / GLYPH_HEIGHT;
  const parts: SheetPart[] = [];
  let w = 0;
  for (let i = 0; i < panels.length; i++) {
    const pair = Math.floor(i / 2);
    const x = margin + pad + (i % 2) * (a + gap + 2 * pad);
    const y = margin + pad + pair * (b + gap + 2 * pad);
    parts.push({ rings: [panels[i].cut.map((q) => [x + q[0], y + (b - q[1])] as Pt)], op: 'cut', ref: 'box:probe' });
    if (i % 2 === 1) {
      const rings = textShape(String(Math.round(kerfOf[i] * 100)));
      const xs = rings.flat().map((q) => q[0]);
      const ys = rings.flat().map((q) => q[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const lx = x + a + gap + 2 * pad;
      const ly = y + (b - textH) / 2;
      parts.push({ rings: rings.map((r) => r.map((q) => [lx + (q[0] - x0) * k, ly + (q[1] - y0) * k] as Pt)), op: 'fill', ref: 'box:label' });
      w = Math.max(w, lx + (Math.max(...xs) - x0) * k + margin);
    }
  }
  const rows = Math.ceil(panels.length / 2);
  return { parts, w: Math.max(w, margin * 2 + 2 * a + gap), h: margin + rows * (b + 2 * pad) + (rows - 1) * gap + margin };
}
