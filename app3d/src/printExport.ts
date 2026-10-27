// Export: aus allen Körpern entsteht das endgültige Netz (volle Körper vereint, Löcher abgezogen),
// das als STL oder 3MF gespeichert wird. Dazu die Druckprüfung (Bauraum, schwebende Teile, dünne Stellen).
import type { Manifold } from 'manifold-3d';
import { featureSize, type Shape } from '../../src/geometry';
import { makeZip } from '../../src/zip';
import { fitsInBuildVolume, type Bed, type Box3 } from './bed';
import { loadManifold, toManifold } from './csg';
import type { Part } from './model3d';

/** Endgültiges Netz in Weltkoordinaten (mm, Ursprung Mitte Bett, z = 0 ist das Bett) und die getrennten Teile davon. */
export interface FinalModel {
  pos: Float32Array;
  idx: Uint32Array;
  /** Umgebungsquader der zusammenhängenden Teile (Stücke, die sich nicht berühren, sind getrennt) */
  components: Box3[];
}

/**
 * Alle vollen Körper vereinen und alle Löcher abziehen. null = nichts zu drucken,
 * 'error' = ein Körper ist als Netz nicht in Ordnung.
 */
export async function buildFinal(parts: Part[]): Promise<FinalModel | null | 'error'> {
  const solids = parts.filter((p) => !p.hole);
  const holes = parts.filter((p) => p.hole);
  if (solids.length === 0) return null;
  const m = await loadManifold();
  const owned: Manifold[] = [];
  try {
    const make = (list: Part[]): Manifold[] | null => {
      const out: Manifold[] = [];
      for (const p of list) {
        const x = toManifold(m, p);
        if (!x) return null;
        owned.push(x);
        out.push(x);
      }
      return out;
    };
    const sm = make(solids);
    const hm = make(holes);
    if (!sm || !hm) return 'error';
    let result = m.Manifold.union(sm);
    owned.push(result);
    if (hm.length) {
      result = result.subtract(m.Manifold.union(hm));
      owned.push(result);
    }
    if (result.isEmpty()) return null;
    const out = result.getMesh();
    const stride = out.numProp;
    const n = out.vertProperties.length / stride;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set(out.vertProperties.subarray(i * stride, i * stride + 3), i * 3);
    const components = result.decompose().map((c) => {
      const b = c.boundingBox();
      c.delete();
      return { min: [b.min[0], b.min[1], b.min[2]], max: [b.max[0], b.max[1], b.max[2]] } as Box3;
    });
    return { pos, idx: Uint32Array.from(out.triVerts), components };
  } finally {
    owned.forEach((x) => x.delete());
  }
}

/** Verschiebung ins Koordinatensystem des Druckers: Ursprung in der vorderen linken Bettecke. */
export const bedCorner = (bed: Bed): [number, number, number] => [bed.width / 2, bed.depth / 2, 0];

/** Binäres STL (Millimeter). */
export function toStl(model: Pick<FinalModel, 'pos' | 'idx'>, shift: [number, number, number] = [0, 0, 0]): Uint8Array<ArrayBuffer> {
  const tris = model.idx.length / 3;
  const buf = new ArrayBuffer(84 + tris * 50);
  const v = new DataView(buf);
  new TextEncoder().encodeInto('MINT2Go 3D-Druck (mm)', new Uint8Array(buf, 0, 80));
  v.setUint32(80, tris, true);
  const p = model.pos;
  let o = 84;
  for (let t = 0; t < tris; t++) {
    const a = model.idx[t * 3] * 3;
    const b = model.idx[t * 3 + 1] * 3;
    const c = model.idx[t * 3 + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const wx = p[c] - p[a];
    const wy = p[c + 1] - p[a + 1];
    const wz = p[c + 2] - p[a + 2];
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const f of [nx, ny, nz]) {
      v.setFloat32(o, f, true);
      o += 4;
    }
    for (const i of [a, b, c]) {
      v.setFloat32(o, p[i] + shift[0], true);
      v.setFloat32(o + 4, p[i + 1] + shift[1], true);
      v.setFloat32(o + 8, p[i + 2] + shift[2], true);
      o += 12;
    }
    v.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

const num = (x: number): string => String(Math.round(x * 10000) / 10000);

/** 3MF (ZIP mit Modell-XML, Einheit Millimeter). */
export function to3mf(model: Pick<FinalModel, 'pos' | 'idx'>, shift: [number, number, number] = [0, 0, 0]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const verts: string[] = [];
  for (let i = 0; i < model.pos.length; i += 3)
    verts.push(`<vertex x="${num(model.pos[i] + shift[0])}" y="${num(model.pos[i + 1] + shift[1])}" z="${num(model.pos[i + 2] + shift[2])}"/>`);
  const tris: string[] = [];
  for (let i = 0; i < model.idx.length; i += 3) tris.push(`<triangle v1="${model.idx[i]}" v2="${model.idx[i + 1]}" v3="${model.idx[i + 2]}"/>`);
  const modelXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="de-DE" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    '<metadata name="Application">MINT2Go 3D</metadata>' +
    `<resources><object id="1" type="model"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object></resources>` +
    '<build><item objectid="1"/></build></model>';
  const types =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
  return makeZip([
    { name: '[Content_Types].xml', data: enc.encode(types) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: '3D/3dmodel.model', data: enc.encode(modelXml) },
  ]);
}

// ---------- Druckprüfung ----------
export interface PrintCheck {
  /** nichts zu drucken */
  empty: boolean;
  /** etwas liegt außerhalb des Bauraums */
  outside: boolean;
  /** ein Stück schwebt über dem Bett (berührt weder das Bett noch ein anderes Stück darunter) */
  floating: boolean;
  /** sehr dünne Stellen (dünner als zwei Düsenbreiten) */
  thin: boolean;
}

const FLOAT_TOLERANCE = 0.05; // mm

/** Skalierte Ringe eines gezeichneten Körpers in mm. */
const scaledOutline = (p: Part): Shape => (p.outline ? p.outline.rings.map((r) => r.map(([x, y]) => [x * p.w, y * p.d] as [number, number])) : []);

export function printCheck(parts: Part[], model: Pick<FinalModel, 'components'> | null, bed: Bed, nozzle: number): PrintCheck {
  if (!model || model.components.length === 0) return { empty: true, outside: false, floating: false, thin: false };
  const outside = model.components.some((c) => !fitsInBuildVolume(c, bed));
  const floating = model.components.some((c) => c.min[2] > FLOAT_TOLERANCE);
  // featureSize = 4 * Fläche / Umfang ist bei einem Streifen etwa die doppelte Breite -> Breite < 2 Düsen = Maß < 4 Düsen
  const thin = parts.some((p) => !p.hole && p.kind === 'extrude' && featureSize(scaledOutline(p)) < 4 * nozzle);
  return { empty: false, outside, floating, thin };
}
