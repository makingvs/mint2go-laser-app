// Spielfigur: Sockel (Ø 25 mm) mit einfachen Formen und Buchstaben darauf, höchstens 30 mm hoch.
// Reine Rechnung (ohne three.js/Oberfläche, testbar): Sockel, Größen, Druckprüfung mit Überhang.
import type { Bed } from './bed';
import { fitsInBuildVolume } from './bed';
import { KIND_SIZE, type PartKind } from './mesh';
import { createPart, partBounds, type Part } from './model3d';
import { printCheck, type FinalModel } from './printExport';

export const BASE_DIAMETER = 25; // Sockel, mm
export const BASE_HEIGHT = 3;
export const BASE_MIN = 15; // kleinster/größter Durchmesser, den das Kind einstellen kann
export const BASE_MAX = 40;
export const FIGURE_MAX_HEIGHT = 30; // Gesamthöhe inklusive Sockel, mm
/** Arbeitsfläche der Figur-Ansicht: klein, damit die Figur groß im Bild ist (der Rahmen zeigt die 30 mm Höhe). */
export const FIGURE_BED: Bed = { width: 60, depth: 60, height: FIGURE_MAX_HEIGHT };

/** Ab diesem Winkel (von der Senkrechten) ist eine Fläche ein Überhang; 45° druckt jeder Drucker ohne Stützen. */
export const OVERHANG_ANGLE = 45;
/** So weit darf ein Überhang ausladen (mm), bevor er zu groß ist; kleine Ausladungen überbrückt der Drucker. */
export const MAX_OVERHANG_REACH = 5;

const FLOAT_TOLERANCE = 0.05;

export const isBase = (p: Pick<Part, 'tag'>): boolean => p.tag === 'base';

/** Der Sockel: ein flacher Zylinder in der Mitte, steht auf dem Bett. */
export function makeBase(diameter = BASE_DIAMETER): Part {
  return { ...createPart('cylinder'), w: diameter, d: diameter, h: BASE_HEIGHT, tag: 'base' };
}

/** Neue Figur: nur der Sockel. */
export const newFigureParts = (): Part[] => [makeBase()];

/** Durchmesser ändern (bleibt rund, begrenzt). */
export function resizeBase(p: Part, diameter: number): Part {
  const v = Math.round(Math.min(BASE_MAX, Math.max(BASE_MIN, diameter)) * 10) / 10;
  return { ...p, w: v, d: v };
}

/** Startgröße der Grundkörper auf dem Sockel (Breite, Tiefe, Höhe) – klein genug für Ø 25 mm. */
export const FIGURE_KIND_SIZE: Record<PartKind, [number, number, number]> = {
  box: [12, 12, 12],
  sphere: [12, 12, 12],
  cylinder: [12, 12, 12],
  cone: [12, 12, 14],
  pyramid: [12, 12, 12],
  roof: [14, 12, 10],
  dome: [14, 14, 8],
  ring: [18, 18, 4],
};

/** Grundkörper in Figur-Größe, in der Mitte des Sockels (z wird vom Editor auf die Auflage gesetzt). */
export function makeFigureKind(kind: PartKind): Part {
  const [w, d, h] = FIGURE_KIND_SIZE[kind] ?? KIND_SIZE[kind];
  return { ...createPart(kind), w, d, h };
}

/** Wie hoch darf ein Körper mit diesem Boden (z) noch werden? */
export const maxHeightAt = (z: number): number => Math.max(2, FIGURE_MAX_HEIGHT - z);

// ---------- Überhang ----------
export interface OverhangSpot {
  /** Schwerpunkt der überhängenden Fläche (mm) */
  at: [number, number, number];
  /** größte Ausladung in x oder y (mm) */
  reach: number;
  area: number;
}

/**
 * Überhängende Flächen im fertigen Netz: nach unten zeigend und flacher als `angle` Grad von der Senkrechten
 * (45° = Wand gerade noch ohne Stütze, 90° = waagrechte Decke). Flächen, die auf dem Bett liegen, zählen nicht.
 * Zusammenhängende Flächen werden zu einer Stelle zusammengefasst; Rückgabe: alle Stellen.
 */
export function findOverhangs(model: Pick<FinalModel, 'pos' | 'idx'>, angle = OVERHANG_ANGLE): OverhangSpot[] {
  const { pos, idx } = model;
  const limit = -Math.sin((angle * Math.PI) / 180) - 0.01; // Normale zeigt steiler nach unten als die Grenze
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(a) !== r) {
      const n = parent.get(a)!;
      parent.set(a, r);
      a = n;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    parent.set(find(a), find(b));
  };
  const flagged: { a: number; area: number; cx: number; cy: number; cz: number; minx: number; maxx: number; miny: number; maxy: number }[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    const ax = pos[a * 3];
    const ay = pos[a * 3 + 1];
    const az = pos[a * 3 + 2];
    const bz = pos[b * 3 + 2];
    const cz = pos[c * 3 + 2];
    if (Math.max(az, bz, cz) <= FLOAT_TOLERANCE) continue; // liegt auf dem Bett
    const ux = pos[b * 3] - ax;
    const uy = pos[b * 3 + 1] - ay;
    const uz = bz - az;
    const wx = pos[c * 3] - ax;
    const wy = pos[c * 3 + 1] - ay;
    const wz = cz - az;
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9 || nz / len >= limit) continue;
    const xs = [ax, pos[b * 3], pos[c * 3]];
    const ys = [ay, pos[b * 3 + 1], pos[c * 3 + 1]];
    flagged.push({
      a,
      area: len / 2,
      cx: (xs[0] + xs[1] + xs[2]) / 3,
      cy: (ys[0] + ys[1] + ys[2]) / 3,
      cz: (az + bz + cz) / 3,
      minx: Math.min(...xs),
      maxx: Math.max(...xs),
      miny: Math.min(...ys),
      maxy: Math.max(...ys),
    });
    for (const v of [a, b, c]) if (!parent.has(v)) parent.set(v, v);
    union(a, b);
    union(b, c);
  }
  const groups = new Map<number, { area: number; sx: number; sy: number; sz: number; minx: number; maxx: number; miny: number; maxy: number }>();
  for (const f of flagged) {
    const r = find(f.a);
    const g = groups.get(r) ?? { area: 0, sx: 0, sy: 0, sz: 0, minx: Infinity, maxx: -Infinity, miny: Infinity, maxy: -Infinity };
    g.area += f.area;
    g.sx += f.cx * f.area;
    g.sy += f.cy * f.area;
    g.sz += f.cz * f.area;
    g.minx = Math.min(g.minx, f.minx);
    g.maxx = Math.max(g.maxx, f.maxx);
    g.miny = Math.min(g.miny, f.miny);
    g.maxy = Math.max(g.maxy, f.maxy);
    groups.set(r, g);
  }
  return [...groups.values()].map((g) => ({
    at: [g.sx / g.area, g.sy / g.area, g.sz / g.area] as [number, number, number],
    reach: Math.max(g.maxx - g.minx, g.maxy - g.miny),
    area: g.area,
  }));
}

/**
 * Welcher volle Körper hat diesen Überhang? Der, dessen Umgebungsquader die Stelle enthält und dessen Boden am höchsten
 * liegt (die Unterseite gehört zu dem Körper, der oben auf dem anderen sitzt); bei Gleichstand der kleinere.
 */
export function partAt(parts: Part[], at: [number, number, number], slack = 0.6): string | null {
  let best: { id: string; low: number; vol: number } | null = null;
  for (const p of parts) {
    if (p.hole || isBase(p)) continue;
    const b = partBounds(p);
    if (at.some((v, k) => v < b.min[k] - slack || v > b.max[k] + slack)) continue;
    const vol = (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
    if (!best || b.min[2] > best.low + 1e-6 || (Math.abs(b.min[2] - best.low) <= 1e-6 && vol < best.vol)) best = { id: p.id, low: b.min[2], vol };
  }
  return best?.id ?? null;
}

// ---------- Druckprüfung der Figur ----------
export interface FigureCheck {
  /** nur der Sockel, noch nichts darauf */
  onlyBase: boolean;
  /** breiter als die Arbeitsfläche */
  outside: boolean;
  /** höher als 30 mm */
  tooTall: boolean;
  /** Überhang mit zu großer Ausladung */
  overhang: boolean;
  /** Körper, die den zu großen Überhang haben (zum Rotfärben) */
  overhangParts: string[];
  /** Teile hängen nicht zusammen oder schweben */
  loose: boolean;
  /** sehr dünne Stellen */
  thin: boolean;
  /** alles in Ordnung: darf exportiert werden */
  ok: boolean;
}

export type ProblemKind = 'outside' | 'tooTall' | 'overhang' | 'loose' | 'thin';

/** Was ist nicht druckbar und was kann das Kind tun? (kurze Sätze für die Fehler-Anzeige) */
export const PROBLEM_TEXT: Record<ProblemKind, string> = {
  outside: 'Etwas ist zu breit oder liegt neben der Fläche. Mach es kleiner oder schiebe es zurück.',
  tooTall: `Die Figur ist höher als ${FIGURE_MAX_HEIGHT} mm. Mach ein Teil niedriger oder setze es tiefer.`,
  overhang: 'Ein Teil ragt zu weit in die Luft. Der Drucker kann nicht in die Luft drucken. Mach das Teil kleiner, gib ihm einen breiteren Hals oder setze es tiefer in das Teil darunter.',
  loose: 'Teile hängen nicht zusammen oder schweben. Schiebe sie so, dass sie sich überlappen. Eine Kugel berührt nur in einem Punkt: setze sie etwas tiefer hinein.',
  thin: 'Eine Stelle ist zu dünn zum Drucken. Mach sie dicker.',
};

/** Die Probleme einer Figur in fester Reihenfolge; leer = druckbar. */
export function figureProblems(c: FigureCheck): ProblemKind[] {
  return (['outside', 'tooTall', 'overhang', 'loose', 'thin'] as const).filter((k) => c[k]);
}

export function figureCheck(parts: Part[], model: Pick<FinalModel, 'pos' | 'idx' | 'components'>, nozzle: number): FigureCheck {
  const onlyBase = !parts.some((p) => !p.hole && !isBase(p));
  const flat: Bed = { ...FIGURE_BED, height: Infinity };
  const outside = model.components.some((c) => !fitsInBuildVolume(c, flat));
  const tooTall = model.components.some((c) => c.max[2] > FIGURE_MAX_HEIGHT + 0.05);
  const loose = model.components.length > 1 || model.components.some((c) => c.min[2] > FLOAT_TOLERANCE);
  const thin = printCheck(parts, model, FIGURE_BED, nozzle).thin;
  const big = findOverhangs(model).filter((s) => s.reach > MAX_OVERHANG_REACH);
  const overhangParts = [...new Set(big.map((s) => partAt(parts, s.at)).filter((id): id is string => !!id))];
  const overhang = big.length > 0;
  return { onlyBase, outside, tooTall, overhang, overhangParts, loose, thin, ok: !onlyBase && !outside && !tooTall && !overhang && !loose && !thin };
}
