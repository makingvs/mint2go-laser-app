// Dreiecksnetze der Grundkörper (reine Rechnung, ohne three.js).
// Jeder Körper liegt im Einheitsquader: x, y in [-0.5, 0.5], z in [0, 1] (Boden auf z = 0).
// Die Dreiecke sind gegen den Uhrzeigersinn von außen gesehen (Normalen zeigen nach außen) und die Netze sind geschlossen.

export type PartKind = 'box' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'roof' | 'dome' | 'ring';

export const PART_KINDS: PartKind[] = ['box', 'sphere', 'cylinder', 'cone', 'pyramid', 'roof', 'dome', 'ring'];

export const KIND_LABELS: Record<PartKind, string> = {
  box: 'Würfel',
  sphere: 'Kugel',
  cylinder: 'Zylinder',
  cone: 'Kegel',
  pyramid: 'Pyramide',
  roof: 'Dach',
  dome: 'Kuppel',
  ring: 'Ring',
};

/** Startgröße (Breite, Tiefe, Höhe in mm). Kuppel und Ring sind flacher, damit sie rund wirken. */
export const KIND_SIZE: Record<PartKind, [number, number, number]> = {
  box: [30, 30, 30],
  sphere: [30, 30, 30],
  cylinder: [30, 30, 30],
  cone: [30, 30, 30],
  pyramid: [30, 30, 30],
  roof: [30, 30, 25],
  dome: [30, 30, 15],
  ring: [40, 40, 10],
};

export interface TriMesh {
  pos: number[]; // x, y, z je Ecke
  idx: number[]; // drei Eckennummern je Dreieck
}

const SEGMENTS = 48;
const RINGS = 24;

class Builder {
  pos: number[] = [];
  idx: number[] = [];
  v(x: number, y: number, z: number): number {
    this.pos.push(x, y, z);
    return this.pos.length / 3 - 1;
  }
  tri(a: number, b: number, c: number): void {
    if (a === b || b === c || a === c) return; // entartet (Pol)
    this.idx.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  done(): TriMesh {
    return { pos: this.pos, idx: this.idx };
  }
}

/** Drehkörper um die z-Achse. Das Profil (Radius, Höhe) läuft außen von unten (r = 0) nach oben (r = 0). */
function revolve(profile: [number, number][], n: number, startAngle = 0, radiusScale = 1): TriMesh {
  const b = new Builder();
  const rings: number[][] = profile.map(([r, z]) => {
    if (r === 0) return Array<number>(n).fill(b.v(0, 0, z));
    return Array.from({ length: n }, (_, j) => {
      const a = startAngle + (j / n) * Math.PI * 2;
      return b.v(r * radiusScale * Math.cos(a), r * radiusScale * Math.sin(a), z);
    });
  });
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const lo = rings[i];
      const up = rings[i + 1];
      b.tri(lo[j], lo[k], up[k]);
      b.tri(lo[j], up[k], up[j]);
    }
  }
  return b.done();
}

function arc(from: number, to: number, steps: number, point: (phi: number) => [number, number]): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => point(from + ((to - from) * i) / steps));
}

function boxMesh(): TriMesh {
  const b = new Builder();
  for (let i = 0; i < 8; i++) b.v((i & 1) - 0.5, ((i >> 1) & 1) - 0.5, (i >> 2) & 1);
  for (const q of [
    [0, 2, 3, 1], // unten
    [4, 5, 7, 6], // oben
    [0, 1, 5, 4], // vorne (-y)
    [3, 2, 6, 7], // hinten (+y)
    [0, 4, 6, 2], // links (-x)
    [1, 3, 7, 5], // rechts (+x)
  ])
    b.quad(q[0], q[1], q[2], q[3]);
  return b.done();
}

function roofMesh(): TriMesh {
  const b = new Builder();
  const a = b.v(-0.5, -0.5, 0);
  const bb = b.v(0.5, -0.5, 0);
  const c = b.v(0, -0.5, 1);
  const a2 = b.v(-0.5, 0.5, 0);
  const b2 = b.v(0.5, 0.5, 0);
  const c2 = b.v(0, 0.5, 1);
  b.tri(a, bb, c); // vorne
  b.tri(a2, c2, b2); // hinten
  b.quad(a, a2, b2, bb); // unten
  b.quad(a, c, c2, a2); // linke Schräge
  b.quad(bb, b2, c2, c); // rechte Schräge
  return b.done();
}

function ringMesh(): TriMesh {
  const b = new Builder();
  const R = 0.375; // Mittelkreis
  const r = 0.125; // Röhre (in z auf die Höhe 1 gestreckt)
  const n = SEGMENTS;
  const m = 24;
  const grid: number[][] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / n) * Math.PI * 2;
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      const v = (j / m) * Math.PI * 2;
      const rad = R + r * Math.cos(v);
      row.push(b.v(rad * Math.cos(u), rad * Math.sin(u), 0.5 + 0.5 * Math.sin(v)));
    }
    grid.push(row);
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const i2 = (i + 1) % n;
      const j2 = (j + 1) % m;
      b.quad(grid[i][j], grid[i2][j], grid[i2][j2], grid[i][j2]);
    }
  return b.done();
}

const cache = new Map<PartKind, TriMesh>();

/** Netz im Einheitsquader (gemeinsam genutzt, nicht verändern). */
export function unitMesh(kind: PartKind): TriMesh {
  let m = cache.get(kind);
  if (!m) {
    m = buildUnitMesh(kind);
    cache.set(kind, m);
  }
  return m;
}

function buildUnitMesh(kind: PartKind): TriMesh {
  switch (kind) {
    case 'box':
      return boxMesh();
    case 'sphere': {
      const prof = arc(-Math.PI / 2, Math.PI / 2, RINGS, (phi) => [0.5 * Math.cos(phi), 0.5 + 0.5 * Math.sin(phi)]);
      prof[0][0] = 0;
      prof[RINGS][0] = 0;
      return revolve(prof, SEGMENTS);
    }
    case 'cylinder':
      return revolve([[0, 0], [0.5, 0], [0.5, 1], [0, 1]], SEGMENTS);
    case 'cone':
      return revolve([[0, 0], [0.5, 0], [0, 1]], SEGMENTS);
    case 'pyramid':
      return revolve([[0, 0], [0.5, 0], [0, 1]], 4, Math.PI / 4, Math.SQRT2); // Ecken bei ±0,5
    case 'roof':
      return roofMesh();
    case 'dome': {
      const prof: [number, number][] = [[0, 0], ...arc(0, Math.PI / 2, RINGS, (phi) => [0.5 * Math.cos(phi), Math.sin(phi)] as [number, number])];
      prof[prof.length - 1][0] = 0;
      return revolve(prof, SEGMENTS);
    }
    case 'ring':
      return ringMesh();
  }
}

/** Rauminhalt des Netzes (positiv bei nach außen zeigenden Dreiecken). */
export function meshVolume(m: TriMesh): number {
  let v = 0;
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3;
    const b = m.idx[t + 1] * 3;
    const c = m.idx[t + 2] * 3;
    const p = m.pos;
    v +=
      (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}
