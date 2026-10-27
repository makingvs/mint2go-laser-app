// Kombinieren: sich berührende Körper vereinen, Löcher ausschneiden (manifold-3d, WebAssembly).
// manifold liefert garantiert geschlossene Körper, auch bei bündigen Flächen (Würfel auf Würfel, Körper auf dem Bett).
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { TriMesh } from './mesh';
import { putMesh } from './meshStore';
import { newId, partBounds, meshOf, worldVertices, type Part } from './model3d';

let api: Promise<ManifoldToplevel> | null = null;

/** Lädt manifold erst beim ersten Vereinen (spart Startzeit); im Browser kommt die .wasm-Datei aus der App. */
export function loadManifold(): Promise<ManifoldToplevel> {
  api ??= (async () => {
    const init = (await import('manifold-3d')).default;
    let config: { locateFile: () => string } | undefined;
    if (typeof window !== 'undefined') {
      const url = (await import('manifold-3d/manifold.wasm?url')).default;
      config = { locateFile: () => url };
    }
    const m = await init(config);
    m.setup();
    return m;
  })();
  return api;
}

export type CombineResult =
  | { kind: 'none' } // nichts zu vereinen (kein Körper berührt den gewählten)
  | { kind: 'error' } // ein Körper ist als Netz nicht in Ordnung
  | { kind: 'ok'; ids: string[]; part: Part | null }; // part null = nichts übrig (Loch hat alles weggeschnitten)

const TOUCH_TOLERANCE = 0.05; // mm

function toManifold(m: ManifoldToplevel, p: Part): Manifold | null {
  try {
    const mesh = new m.Mesh({ numProp: 3, vertProperties: new Float32Array(worldVertices(p)), triVerts: new Uint32Array(meshOf(p).idx) });
    const man = new m.Manifold(mesh);
    if (man.status() !== 'NoError') {
      man.delete();
      return null;
    }
    return man;
  } catch {
    return null;
  }
}

const components = (man: Manifold): number => {
  const parts = man.decompose();
  const n = parts.length;
  parts.forEach((c) => c.delete());
  return n;
};

const boxesTouch = (a: Part, b: Part): boolean => {
  const x = partBounds(a);
  const y = partBounds(b);
  return [0, 1, 2].every((k) => x.min[k] <= y.max[k] + TOUCH_TOLERANCE && y.min[k] <= x.max[k] + TOUCH_TOLERANCE);
};

/**
 * Vereint den gewählten Körper mit allen, die ihn (auch über andere hinweg) berühren oder überlappen.
 * Volle Körper ergeben die Summe, Löcher werden davon abgezogen. Das Ergebnis ist ein einziger Körper ('mesh').
 */
export async function combine(selectedId: string, parts: Part[]): Promise<CombineResult> {
  const m = await loadManifold();
  const mans = new Map<string, Manifold>();
  const owned: Manifold[] = [];
  const keep = <T extends Manifold>(x: T): T => {
    owned.push(x);
    return x;
  };
  try {
    // 1. Wer berührt wen? (erst grob über die Umgebungsquader, dann genau: Vereinigung hat weniger Teile als die Summe)
    const byId = new Map(parts.map((p) => [p.id, p]));
    if (!byId.has(selectedId)) return { kind: 'none' };
    const need = new Set<string>();
    const manOf = (p: Part): Manifold | null => {
      let x = mans.get(p.id);
      if (!x) {
        const made = toManifold(m, p);
        if (!made) return null;
        x = keep(made);
        mans.set(p.id, x);
      }
      return x;
    };
    const comps = new Map<string, number>();
    const touching = (a: Part, b: Part): boolean | null => {
      if (!boxesTouch(a, b)) return false;
      const ma = manOf(a);
      const mb = manOf(b);
      if (!ma || !mb) return null;
      for (const p of [a, b]) if (!comps.has(p.id)) comps.set(p.id, components(mans.get(p.id)!));
      const u = keep(ma.add(mb));
      return components(u) < comps.get(a.id)! + comps.get(b.id)!;
    };

    const group: Part[] = [];
    const queue: Part[] = [byId.get(selectedId)!];
    need.add(selectedId);
    while (queue.length) {
      const a = queue.shift()!;
      group.push(a);
      for (const b of parts) {
        if (need.has(b.id)) continue;
        const t = touching(a, b);
        if (t === null) return { kind: 'error' };
        if (t) {
          need.add(b.id);
          queue.push(b);
        }
      }
    }
    if (group.length < 2) return { kind: 'none' };
    const solids = group.filter((p) => !p.hole);
    const holes = group.filter((p) => p.hole);
    if (solids.length === 0) return { kind: 'none' };

    // 2. Summe der vollen Körper minus Summe der Löcher
    const ms = solids.map((p) => manOf(p));
    if (ms.some((x) => !x)) return { kind: 'error' };
    let result = keep(m.Manifold.union(ms as Manifold[]));
    if (holes.length) {
      const hs = holes.map((p) => manOf(p));
      if (hs.some((x) => !x)) return { kind: 'error' };
      result = keep(result.subtract(keep(m.Manifold.union(hs as Manifold[]))));
    }
    const ids = group.map((p) => p.id);
    if (result.isEmpty()) return { kind: 'ok', ids, part: null };

    // 3. Ergebnis in den Einheitsquader bringen: Körper mit Mitte, Größe und Abstand zum Bett
    const out = result.getMesh();
    const stride = out.numProp;
    const v = out.vertProperties;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i += stride)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[i + k]);
        max[k] = Math.max(max[k], v[i + k]);
      }
    const size = [0, 1, 2].map((k) => Math.max(max[k] - min[k], 0.01));
    const cx = (min[0] + max[0]) / 2;
    const cy = (min[1] + max[1]) / 2;
    const round = (x: number): number => Math.round(x * 1e5) / 1e5;
    const pos: number[] = [];
    for (let i = 0; i < v.length; i += stride) pos.push(round((v[i] - cx) / size[0]), round((v[i + 1] - cy) / size[1]), round((v[i + 2] - min[2]) / size[2]));
    const mesh: TriMesh = { pos, idx: Array.from(out.triVerts) };
    const meshId = newId();
    putMesh(meshId, mesh);
    const r1 = (x: number): number => Math.round(x * 1000) / 1000;
    return {
      kind: 'ok',
      ids,
      part: { id: newId(), kind: 'mesh', meshId, x: r1(cx), y: r1(cy), z: r1(min[2]), w: r1(size[0]), d: r1(size[1]), h: r1(size[2]), rot: 0 },
    };
  } finally {
    owned.forEach((x) => x.delete());
  }
}
