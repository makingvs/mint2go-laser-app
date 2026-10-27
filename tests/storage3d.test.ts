import { describe, expect, it } from 'vitest';
import { combine } from '../app3d/src/csg';
import { buildZip3d, createDesign, packDesign, unpackDesign } from '../app3d/src/designIO';
import { getMesh } from '../app3d/src/meshStore';
import { zipDesignNames } from '../app3d/src/names3d';
import { createPart, makeOutlinePart, meshOf, type Part } from '../app3d/src/model3d';
import { DEFAULT_SETTINGS, normalizeSettings, storage } from '../app3d/src/storage3d';

const bed = { width: 220, depth: 220, height: 250 };
const box = (x: number, z = 0, s = 30): Part => ({ ...createPart('box', x, 0), z, w: s, d: s, h: s });

// In Node gibt es kein IndexedDB: der Speicher läuft im Arbeitsspeicher (gleiche Logik).
describe('Speicher der 3D-App', () => {
  it('legt Profile an und findet bestehende wieder', async () => {
    await storage.init();
    expect(storage.persistent).toBe(false);
    expect(await storage.createProfile('Lena', '🦊')).toEqual({ id: 'Lena', name: 'Lena', icon: '🦊' });
    expect((await storage.createProfile('Lena', '🐱')).icon).toBe('🦊');
    await storage.createProfile('Tom', '🐻');
    expect((await storage.listProfiles()).map((p) => p.id)).toEqual(['Lena', 'Tom']);
  });

  it('speichert Arbeiten je Kind, sortiert nach Änderung, Löschen geht in den Papierkorb', async () => {
    const d1 = { ...createDesign(), id: 'd-1', updated: 10 };
    const d2 = { ...createDesign(), id: 'd-2', updated: 20 };
    await storage.saveDesign('Lena', d1);
    await storage.saveDesign('Lena', d2);
    await storage.saveDesign('Tom', { ...createDesign(), id: 'd-3' });
    expect((await storage.listDesigns('Lena')).map((d) => d.id)).toEqual(['d-2', 'd-1']);
    await storage.deleteDesign('Lena', 'd-1');
    expect((await storage.listDesigns('Lena')).map((d) => d.id)).toEqual(['d-2']);
    await storage.deleteDesign('Tom', 'd-2'); // falsches Kind: nichts passiert
    expect((await storage.listDesigns('Lena')).map((d) => d.id)).toEqual(['d-2']);
  });

  it('löscht einen Benutzer samt Arbeiten (Tier-Symbol wird wieder frei)', async () => {
    await storage.createProfile('Frosch', '🐸');
    await storage.saveDesign('Frosch', { ...createDesign(), id: 'd-f1' });
    await storage.deleteProfile('Frosch');
    expect((await storage.listProfiles()).map((p) => p.icon)).not.toContain('🐸');
    expect((await storage.listAllDesigns()).some((d) => d.profile === 'Frosch')).toBe(false);
    expect((await storage.createProfile('Frosch', '🐸')).icon).toBe('🐸');
  });

  it('Einstellungen: Bett, Düse und Dateiart mit Grenzen, zurücksetzen', async () => {
    const saved = await storage.putSettings({ bed: { width: 256, depth: 5000, height: 256 }, nozzle: 0.6, format: '3mf' });
    expect(saved.bed).toEqual({ width: 256, depth: 1000, height: 256 });
    expect(saved.nozzle).toBe(0.6);
    expect(saved.format).toBe('3mf');
    expect((await storage.getSettings()).format).toBe('3mf');
    expect(normalizeSettings({ format: 'obj' }).format).toBe('stl');
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect((await storage.resetSettings()).bed).toEqual(DEFAULT_SETTINGS.bed);
    expect((await storage.getSettings()).format).toBe('stl');
  });
});

describe('Arbeit speichern und laden', () => {
  it('Körper bleiben gleich; vereinte Körper bringen ihr Netz mit', async () => {
    const a = box(0);
    const b = { ...createPart('sphere', 20, 0), w: 30, d: 30, h: 30, hole: true };
    const r = await combine(a.id, [a, b]);
    if (r.kind !== 'ok' || !r.part) throw new Error('kein Ergebnis');
    const text = makeOutlinePart([[[0, 0], [40, 0], [40, 10], [0, 10]]], { longest: 40 }, 5, bed, 60, 0)!;
    const parts = [r.part, text, box(100)];

    const packed = packDesign({ id: 'x1', created: 1, thumb: 'data:image/jpeg;base64,AAAA' }, parts, 50);
    expect(Object.keys(packed.meshes)).toEqual([r.part.meshId]); // nur das Netz, das gebraucht wird
    expect(packed.updated).toBe(50);
    expect(packed.thumb).toBe('data:image/jpeg;base64,AAAA');

    // über den Speicher (strukturierter Klon wie in IndexedDB)
    await storage.saveDesign('Lena', packed);
    const loaded = (await storage.listDesigns('Lena')).find((d) => d.id === 'x1')!;
    const original = getMesh(r.part.meshId!)!;
    const reopened = unpackDesign(loaded);
    expect(reopened).toEqual(parts);
    const m = meshOf(reopened[0]);
    expect(m.idx).toEqual(original.idx);
    expect(m.pos.length).toBe(original.pos.length);
    for (let i = 0; i < m.pos.length; i++) expect(m.pos[i]).toBeCloseTo(original.pos[i], 5);
  });

  it('neue Arbeit ist leer', () => {
    const d = createDesign();
    expect(d.parts).toEqual([]);
    expect(d.created).toBe(d.updated);
  });
});

describe('ZIP aller Arbeiten', () => {
  it('Namen: Ordner je Kind, gleiche Zeit bekommt Nummern', () => {
    const when = new Date(2026, 9, 27, 14, 5, 9);
    expect(zipDesignNames([{ kind: 'Lena', when }, { kind: 'Lena', when }, { kind: 'Tom Müller', when }], 'stl')).toEqual([
      'Lena/Lena_2026-10-27_14-05-09.stl',
      'Lena/Lena_2026-10-27_14-05-09_2.stl',
      'Tom_Müller/Tom_Müller_2026-10-27_14-05-09.stl',
    ]);
  });

  it('enthält eine Datei je druckbarer Arbeit; leere und reine Loch-Arbeiten fehlen', async () => {
    const printer = { bed, nozzle: 0.4 };
    const ok1 = { ...packDesign({ id: 'z1', created: 1 }, [box(0)], 1000), profile: 'Lena' };
    const ok2 = { ...packDesign({ id: 'z2', created: 2 }, [box(0), box(80)], 2000), profile: 'Tom' };
    const empty = { ...createDesign(), id: 'z3', profile: 'Lena' };
    const holesOnly = { ...packDesign({ id: 'z4', created: 4 }, [{ ...box(0), hole: true }], 3000), profile: 'Lena' };
    const profiles = [{ id: 'Lena', name: 'Lena' }, { id: 'Tom', name: 'Tom' }];
    const zip = (await buildZip3d([ok1, ok2, empty, holesOnly], profiles, printer, 'stl'))!;
    const names: string[] = [];
    const v = new DataView(zip.buffer);
    for (let o = 0; o + 4 <= zip.length && v.getUint32(o, true) === 0x04034b50; ) {
      const size = v.getUint32(o + 18, true);
      const nl = v.getUint16(o + 26, true);
      names.push(new TextDecoder().decode(zip.subarray(o + 30, o + 30 + nl)));
      o += 30 + nl + size;
    }
    expect(names).toHaveLength(2);
    expect(names.every((n) => n.endsWith('.stl'))).toBe(true);
    expect(names.some((n) => n.startsWith('Lena/'))).toBe(true);
    expect(names.some((n) => n.startsWith('Tom/'))).toBe(true);
    expect(await buildZip3d([empty], profiles, printer, '3mf')).toBeNull();
  });
});
