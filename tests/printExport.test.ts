import { describe, expect, it } from 'vitest';
import { textShape } from '../src/text';
import { bedCorner, buildFinal, printCheck, to3mf, toStl, type FinalModel } from '../app3d/src/printExport';
import { createPart, makeOutlinePart, type Part } from '../app3d/src/model3d';

const bed = { width: 200, depth: 200, height: 100 };
const box = (x: number, y: number, z: number, s = 30): Part => ({ ...createPart('box', x, y), z, w: s, d: s, h: s });

function volume(m: Pick<FinalModel, 'pos' | 'idx'>): number {
  let v = 0;
  const p = m.pos;
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3;
    const b = m.idx[t + 1] * 3;
    const c = m.idx[t + 2] * 3;
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}

/** Liest die Einträge eines unkomprimierten ZIPs (wie makeZip sie schreibt). */
function readZip(zip: Uint8Array): Map<string, string> {
  const out = new Map<string, string>();
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let o = 0;
  while (o + 4 <= zip.length && v.getUint32(o, true) === 0x04034b50) {
    const size = v.getUint32(o + 18, true);
    const nameLen = v.getUint16(o + 26, true);
    const name = new TextDecoder().decode(zip.subarray(o + 30, o + 30 + nameLen));
    out.set(name, new TextDecoder().decode(zip.subarray(o + 30 + nameLen, o + 30 + nameLen + size)));
    o += 30 + nameLen + size;
  }
  return out;
}

describe('Endgültiges Netz', () => {
  it('ein Körper: Rauminhalt und ein Stück', async () => {
    const f = (await buildFinal([box(0, 0, 0)])) as FinalModel;
    expect(volume(f)).toBeCloseTo(27000, 0);
    expect(f.components).toHaveLength(1);
    expect(f.components[0].min[2]).toBeCloseTo(0, 6);
    expect(f.components[0].max[2]).toBeCloseTo(30, 6);
  });

  it('überlappende Körper werden vereint, Löcher abgezogen (auch wenn nichts vorher vereint wurde)', async () => {
    const plate = { ...box(0, 0, 0, 40), h: 20 };
    const bore = { ...createPart('box', 0, 0), z: -5, w: 10, d: 10, h: 30, hole: true };
    const f = (await buildFinal([plate, bore, box(20, 0, 0, 20)])) as FinalModel;
    // Platte 40x40x20 (32000) + Würfel 20^3 (8000) - Überlappung (x 10..20: 10*20*20 = 4000) - Bohrung (10*10*20 = 2000, liegt nicht im Würfel)
    expect(volume(f)).toBeCloseTo(32000 + 8000 - 4000 - 2000, 0);
    expect(f.components).toHaveLength(1);
  });

  it('getrennte Stücke bleiben getrennte Teile', async () => {
    const f = (await buildFinal([box(0, 0, 0), box(80, 0, 0)])) as FinalModel;
    expect(f.components).toHaveLength(2);
  });

  it('nur Löcher oder alles weggeschnitten: nichts zu drucken', async () => {
    expect(await buildFinal([])).toBeNull();
    expect(await buildFinal([{ ...box(0, 0, 0), hole: true }])).toBeNull();
    expect(await buildFinal([box(0, 0, 0, 10), { ...box(0, 0, -5, 40), hole: true }])).toBeNull();
  });

  it('gezeichneter Text (eigene Extrusion) lässt sich exportieren', async () => {
    const text = makeOutlinePart(textShape('HALLO 08'), { scale: 2 }, 4, bed)!;
    const f = (await buildFinal([text])) as FinalModel;
    expect(f.idx.length).toBeGreaterThan(100);
    expect(volume(f)).toBeGreaterThan(100);
  });
});

describe('STL', () => {
  it('Kopf, Dreieckszahl, Größe und Verschiebung stimmen', async () => {
    const f = (await buildFinal([box(0, 0, 0, 20)])) as FinalModel;
    const stl = toStl(f, bedCorner(bed));
    const v = new DataView(stl.buffer);
    const n = v.getUint32(80, true);
    expect(n).toBe(f.idx.length / 3);
    expect(stl.length).toBe(84 + n * 50);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    for (let t = 0; t < n; t++)
      for (let k = 0; k < 3; k++) {
        const o = 84 + t * 50 + 12 + k * 12;
        minX = Math.min(minX, v.getFloat32(o, true));
        maxX = Math.max(maxX, v.getFloat32(o, true));
        minZ = Math.min(minZ, v.getFloat32(o + 8, true));
      }
    expect(minX).toBeCloseTo(90, 4); // Bett 200 breit: Mitte = 100, Würfel 20 breit
    expect(maxX).toBeCloseTo(110, 4);
    expect(minZ).toBeCloseTo(0, 6);
  });

  it('Normalen zeigen nach außen (Würfel: unterstes Dreieck zeigt nach -z)', async () => {
    const f = (await buildFinal([box(0, 0, 0, 20)])) as FinalModel;
    const v = new DataView(toStl(f).buffer);
    let down = 0;
    for (let t = 0; t < f.idx.length / 3; t++) if (v.getFloat32(84 + t * 50 + 8, true) < -0.99) down++;
    expect(down).toBe(2); // Boden = 2 Dreiecke
  });
});

describe('3MF', () => {
  it('enthält die drei Pflichtdateien und das Netz in Millimetern', async () => {
    const f = (await buildFinal([box(0, 0, 0, 20)])) as FinalModel;
    const files = readZip(to3mf(f, bedCorner(bed)));
    expect([...files.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
    const xml = files.get('3D/3dmodel.model')!;
    expect(xml).toContain('unit="millimeter"');
    expect((xml.match(/<vertex /g) ?? []).length).toBe(f.pos.length / 3);
    expect((xml.match(/<triangle /g) ?? []).length).toBe(f.idx.length / 3);
    expect(xml).toContain('x="90"');
    expect(files.get('_rels/.rels')).toContain('/3D/3dmodel.model');
  });
});

describe('Druckprüfung', () => {
  const comp = (minZ: number, x0 = -10, x1 = 10): FinalModel['components'][number] => ({ min: [x0, -10, minZ], max: [x1, 10, minZ + 20] });

  it('alles in Ordnung', () => {
    const c = printCheck([box(0, 0, 0)], { components: [comp(0)] }, bed, 0.4);
    expect(c).toEqual({ empty: false, outside: false, floating: false, thin: false });
  });

  it('nichts zu drucken', () => {
    expect(printCheck([], null, bed, 0.4).empty).toBe(true);
    expect(printCheck([], { components: [] }, bed, 0.4).empty).toBe(true);
  });

  it('außerhalb des Bauraums', () => {
    expect(printCheck([], { components: [comp(0, 95, 115)] }, bed, 0.4).outside).toBe(true);
    expect(printCheck([], { components: [{ min: [0, 0, 0], max: [10, 10, 120] }] }, bed, 0.4).outside).toBe(true); // zu hoch
  });

  it('schwebendes Stück', () => {
    const c = printCheck([], { components: [comp(0), comp(15)] }, bed, 0.4);
    expect(c.floating).toBe(true);
    expect(printCheck([], { components: [comp(0.01)] }, bed, 0.4).floating).toBe(false); // Rundungsfehler
  });

  it('zu dünne Stellen bei gezeichneten Körpern (Strichbreite unter zwei Düsen)', () => {
    // Streifen 50 mm lang, Breite d (so schmal kommt er z. B. durch kleines Verkleinern eines Textes zustande)
    const strip = (d: number): Part => ({ ...makeOutlinePart([[[0, 0], [100, 0], [100, 10], [0, 10]]], { longest: 50 }, 5, bed)!, d });
    expect(printCheck([strip(0.5)], { components: [comp(0)] }, bed, 0.4).thin).toBe(true); // 0,5 mm breit < 0,8 mm
    expect(printCheck([strip(5)], { components: [comp(0)] }, bed, 0.4).thin).toBe(false); // 5 mm breit
    expect(printCheck([{ ...strip(0.5), hole: true }], { components: [comp(0)] }, bed, 0.4).thin).toBe(false); // Löcher werden nicht gedruckt
  });
});
