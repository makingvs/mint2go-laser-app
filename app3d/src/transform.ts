// Werkzeuge, die einen Körper umformen: Kippen, Spiegeln, Ausrichten und das merkende Kopieren (reine Rechnung).
// Kippen und Spiegeln "backen" die Form in ein Netz (Part.kind 'mesh'); danach lassen sich Größe, Lage und Löcher
// wie bei jedem anderen Körper ändern.
import { putMesh } from './meshStore';
import { meshOf, newId, partBounds, worldVertices, type Part } from './model3d';
import type { TriMesh } from './mesh';

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const round3 = (v: number): number => Math.round(v * 1e3) / 1e3;

/** Neuer Körper aus Weltkoordinaten-Eckpunkten: Netz im Einheitsquader, Maße und Mitte aus dem Umgebungsquader. */
function fromWorld(p: Part, v: number[], idx: number[], z: number, extra: Partial<Part> = {}): Part {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[i + k]);
      max[k] = Math.max(max[k], v[i + k]);
    }
  const size = [0, 1, 2].map((k) => Math.max(max[k] - min[k], 0.01));
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const pos: number[] = [];
  for (let i = 0; i < v.length; i += 3) pos.push(round5((v[i] - cx) / size[0]), round5((v[i + 1] - cy) / size[1]), round5((v[i + 2] - min[2]) / size[2]));
  const mesh: TriMesh = { pos, idx };
  const meshId = newId();
  putMesh(meshId, mesh);
  const out: Part = { ...p, ...extra, id: p.id, kind: 'mesh', meshId, x: round3(cx), y: round3(cy), z, w: round3(size[0]), d: round3(size[1]), h: round3(size[2]), rot: 0 };
  delete out.outline;
  delete out.teeth;
  return out;
}

const norm360 = (a: number): number => ((Math.round(a * 10) / 10) % 360 + 360) % 360;

/**
 * Körper um seine Mitte um die x-Achse (vor/zurück) oder y-Achse (links/rechts) kippen.
 * Der Boden bleibt auf der alten Höhe (Auflage), `tilt` zählt die gekippten Grad mit.
 */
export function tiltPart(p: Part, axis: 'x' | 'y', deg: number): Part {
  const v = worldVertices(p);
  const b = partBounds(p);
  const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i += 3) {
    const dx = v[i] - c[0];
    const dy = v[i + 1] - c[1];
    const dz = v[i + 2] - c[2];
    if (axis === 'x') {
      out[i] = c[0] + dx;
      out[i + 1] = c[1] + dy * cos - dz * sin;
      out[i + 2] = c[2] + dy * sin + dz * cos;
    } else {
      out[i] = c[0] + dx * cos + dz * sin;
      out[i + 1] = c[1] + dy;
      out[i + 2] = c[2] - dx * sin + dz * cos;
    }
  }
  const t = p.tilt ?? { x: 0, y: 0 };
  // Grundkörper behalten ihre Art als Herkunft (tag), damit z. B. ein umgedrehter Kegel noch als Kegel erkannt wird
  const tag = p.tag ?? (p.kind !== 'mesh' && p.kind !== 'extrude' ? p.kind : undefined);
  return fromWorld(p, out, meshOf(p).idx, p.z, { ...(tag ? { tag } : {}), tilt: { x: norm360(t.x + (axis === 'x' ? deg : 0)), y: norm360(t.y + (axis === 'y' ? deg : 0)) } });
}

/**
 * Links und rechts vertauschen (an der eigenen senkrechten Mittelebene). Symmetrische Grundkörper bleiben gleich;
 * gezeichnete Umrisse und Netze werden wirklich gespiegelt.
 */
export function mirrorPart(p: Part): Part {
  if (p.kind === 'extrude' && p.outline) {
    const rings = p.outline.rings.map((r) => r.map(([x, y]) => [round5(-x), y] as [number, number]).reverse());
    return { ...p, outline: { id: newId(), rings } };
  }
  if (p.kind === 'mesh' && p.meshId) {
    const m = meshOf(p);
    const pos = m.pos.slice();
    for (let i = 0; i < pos.length; i += 3) pos[i] = round5(-pos[i]);
    const idx = m.idx.slice();
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]; // Spiegelung dreht die Dreiecke um
    const meshId = newId();
    putMesh(meshId, { pos, idx });
    return { ...p, meshId };
  }
  return p;
}

/**
 * Ausrichten: Mitte auf Mitte mit dem Körper, der unter/neben ihm am meisten überlappt (Draufsicht).
 * null, wenn er nichts berührt.
 */
export function alignCenter(p: Part, others: Part[]): Part | null {
  const a = partBounds(p);
  let best: { cx: number; cy: number; area: number } | null = null;
  for (const o of others) {
    if (o.id === p.id || o.hole) continue;
    const b = partBounds(o);
    const w = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
    const d = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
    if (w < -0.05 || d < -0.05) continue;
    const area = Math.max(w, 0.01) * Math.max(d, 0.01);
    if (!best || area > best.area) best = { cx: (b.min[0] + b.max[0]) / 2, cy: (b.min[1] + b.max[1]) / 2, area };
  }
  if (!best) return null;
  const px = (a.min[0] + a.max[0]) / 2;
  const py = (a.min[1] + a.max[1]) / 2;
  return { ...p, x: round3(p.x + best.cx - px), y: round3(p.y + best.cy - py) };
}

/**
 * Kopie, die den letzten Schritt wiederholt: wurde `p` selbst als Kopie von `src` gemacht und dann verschoben,
 * liegt die neue Kopie im gleichen Abstand (Tinkercad: "Duplizieren merkt sich den letzten Schritt").
 * Sonst ein fester Versatz.
 */
export function copyOffset(p: Part, src: Part | undefined, fallback = 15): [number, number, number] {
  if (src) {
    const d: [number, number, number] = [p.x - src.x, p.y - src.y, p.z - src.z];
    if (Math.hypot(...d) >= 1) return d;
  }
  return [fallback, -fallback, 0];
}
