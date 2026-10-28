// "Zeig-mir"-Hilfe der 3D-Werkstatt: führt die Hilfe-Schritte eines Projekts aus (reine Logik; der Editor und die Tests
// benutzen dieselbe Funktion, so ist jedes Projekt auch automatisch durchspielbar).
import { baseShape, type ShapeId } from '../../../src/shapes';
import { textShape } from '../../../src/text';
import type { Bed } from '../bed';
import { combine } from '../csg';
import { applyDim, createPart, findFreeSpot, makeGearPart, makeOutlinePart, makeTubePart, newId, type Part } from '../model3d';
import { restOn } from '../support';
import { alignCenter, mirrorPart, tiltPart } from '../transform';
import { bounds, centerOf, extent, topOf, type HelpOp } from './engine3d';

export interface HelpState {
  parts: Part[];
  selected: string | null;
}

const selectedPart = (st: HelpState): Part | undefined => st.parts.find((p) => p.id === st.selected) ?? st.parts[st.parts.length - 1];

/** Neuen Körper (noch ohne Platz) hinlegen: frei, oben drauf, in die Mitte des gewählten, oder daneben. */
function place(p: Part, st: HelpState, where: string | undefined, bed: Bed, dx = 0, dy = 0, dz = 0): Part {
  const base = selectedPart(st);
  if (!where || where === 'free' || !base) {
    const spot = findFreeSpot(p, st.parts, bed);
    return { ...p, x: spot.x, y: spot.y, z: dz };
  }
  const [cx, cy] = centerOf(base);
  if (where === 'beside') return { ...p, x: bounds(base).max[0] + p.w / 2 + 8 + dx, y: cy + dy, z: dz };
  const z = where === 'on' ? topOf(base) + dz : bounds(base).min[2] + dz; // 'in': auf Höhe des Bodens des gewählten
  const q = { ...p, x: cx + dx, y: cy + dy, z };
  return where === 'on' ? restOn(q, st.parts.filter((o) => o.id !== q.id), q) : q;
}

const append = (st: HelpState, p: Part): HelpState => ({ parts: [...st.parts, p], selected: p.id });
const replace = (st: HelpState, p: Part): HelpState => ({ ...st, parts: st.parts.map((q) => (q.id === p.id ? p : q)) });

/** Eine Hilfe-Aktion ausführen. Gibt den neuen Zustand zurück (async wegen Vereinen). */
export async function applyHelp(st: HelpState, op: HelpOp, bed: Bed): Promise<HelpState> {
  const cur = selectedPart(st);
  switch (op.op) {
    case 'add': {
      let p: Part;
      if (op.kind === 'tube') p = makeTubePart(bed, op.w ?? 24, op.h ?? 60);
      else if (op.kind === 'gear') p = makeGearPart(op.teeth ?? 10, op.h ?? 5, bed);
      else {
        p = createPart(op.kind);
        p = { ...p, w: op.w ?? p.w, d: op.d ?? op.w ?? p.d, h: op.h ?? p.h };
      }
      if (op.hole) p = { ...p, hole: true };
      return append(st, place(p, st, op.place, bed, op.dx, op.dy, op.dz));
    }
    case 'shape': {
      const p = makeOutlinePart(baseShape(op.id as ShapeId), { longest: op.longest ?? 40 }, op.h ?? 10, bed, 0, 0, `shape:${op.id}`);
      if (!p) return st;
      return append(st, place(op.hole ? { ...p, hole: true } : p, st, op.place, bed, op.dx, op.dy, op.dz));
    }
    case 'text': {
      const p = makeOutlinePart(textShape(op.value), { scale: 15 / 7.5 }, op.h ?? 5, bed, 0, 0, 'text'); // Block-Schrift, Großbuchstaben 15 mm
      if (!p) return st;
      return append(st, place(p, st, op.place, bed, op.dx, op.dy, op.dz));
    }
    case 'set':
      return cur ? replace(st, applyDim(cur, op.field, op.value, !!op.lock, bed)) : st;
    case 'tilt':
      return cur ? replace(st, tiltPart(cur, op.axis, op.deg)) : st;
    case 'hole':
      return cur ? replace(st, { ...cur, hole: !cur.hole }) : st;
    case 'align': {
      const a = cur && alignCenter(cur, st.parts);
      return a && cur ? replace(st, a) : st;
    }
    case 'mirror':
      return cur ? replace(st, mirrorPart(cur)) : st;
    case 'copy': {
      if (!cur) return st;
      const c: Part = { ...cur, id: newId(), x: cur.x + (op.dx ?? 15), y: cur.y + (op.dy ?? -15), z: cur.z + (op.dz ?? 0) };
      return append(st, c);
    }
    case 'drop': {
      // auf den Körper legen, den er am meisten überlappt (sonst auf den größten anderen), dann fallen lassen
      if (!cur) return st;
      const others = st.parts.filter((o) => o.id !== cur.id && !o.hole);
      const a = alignCenter(cur, others);
      let q = a;
      if (!q && others.length) {
        const big = others.reduce((m, o) => (extent(o)[0] * extent(o)[1] > extent(m)[0] * extent(m)[1] ? o : m));
        const [cx, cy] = centerOf(big);
        q = { ...cur, x: cx, y: cy };
      }
      return q ? replace(st, restOn({ ...q, x: q.x + (op.dx ?? 0), y: q.y + (op.dy ?? 0) }, others, q)) : st;
    }
    case 'put':
      return cur ? replace(st, { ...cur, x: op.x, y: op.y }) : st;
    case 'select': {
      const solids = st.parts.filter((p) => !p.hole);
      const area = (p: Part): number => extent(p)[0] * extent(p)[1] * extent(p)[2];
      let pick: Part | undefined;
      if (op.pick === 'hole') pick = [...st.parts].reverse().find((p) => p.hole);
      else if (op.pick === 'last') pick = st.parts[st.parts.length - 1];
      else if (op.pick === 'first') pick = st.parts[0];
      else if (op.pick === 'biggest') pick = solids.reduce<Part | undefined>((m, p) => (!m || area(p) > area(m) ? p : m), undefined);
      else if (op.pick === 'smallest') pick = solids.reduce<Part | undefined>((m, p) => (!m || area(p) < area(m) ? p : m), undefined);
      else if (op.pick.startsWith('kind:')) pick = [...solids].reverse().find((p) => p.kind === op.pick.slice(5) || p.tag === op.pick.slice(5));
      else if (op.pick.startsWith('tag:')) pick = [...solids].reverse().find((p) => p.tag === op.pick.slice(4) || p.tag?.startsWith(`${op.pick.slice(4)}:`));
      return pick ? { ...st, selected: pick.id } : st;
    }
    case 'merge': {
      if (!cur) return st;
      const r = await combine(cur.id, st.parts);
      if (r.kind !== 'ok') return st;
      return { parts: [...st.parts.filter((q) => !r.ids.includes(q.id)), ...(r.part ? [r.part] : [])], selected: r.part?.id ?? null };
    }
  }
}

export async function runHelp(st: HelpState, ops: HelpOp[], bed: Bed): Promise<HelpState> {
  let s = st;
  for (const op of ops) s = await applyHelp(s, op, bed);
  return s;
}
