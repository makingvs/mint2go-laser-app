import { describe, expect, it } from 'vitest';
import { normalizeSettings, storage } from '../src/storage';
import { DEFAULT_SETTINGS, createDesign, makeElement } from '../src/model';
import { baseShape } from '../src/shapes';
import { exportFileName, safeName, splitThemeName } from '../src/names';
import { buildZip } from '../src/exporter';
import { crc32, makeZip } from '../src/zip';

// In Node gibt es kein IndexedDB: der Speicher läuft im Arbeitsspeicher (gleiche Logik).
describe('Speicher', () => {
  it('legt Profile an und findet bestehende wieder', async () => {
    await storage.init();
    expect(storage.persistent).toBe(false);
    const a = await storage.createProfile('Lena', '🦊');
    expect(a).toEqual({ id: 'Lena', name: 'Lena', icon: '🦊' });
    const again = await storage.createProfile('Lena', '🐱');
    expect(again.icon).toBe('🦊');
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

  it('speichert Einstellungen mit Grenzen und setzt sie zurück', async () => {
    const saved = await storage.putSettings({ plate: { width: 400, height: 5000 }, colors: { cut: '#00ff00', engrave: 'x', fill: '#000000' }, minSize: 2 });
    expect(saved.plate).toEqual({ width: 400, height: 1000 });
    expect(saved.colors).toEqual({ cut: '#00FF00', engrave: '#0000FF', fill: '#000000' });
    expect((await storage.getSettings()).minSize).toBe(2);
    expect(normalizeSettings({ minSize: -5 }).minSize).toBe(0);
    expect((await storage.resetSettings()).plate).toEqual(DEFAULT_SETTINGS.plate);
    expect((await storage.getSettings()).plate).toEqual(DEFAULT_SETTINGS.plate);
  });

  it('nimmt eigene SVG-Bilder an und lehnt Ungültiges ab', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    await storage.addLibrarySvg('🐾 Tiere', 'Fuchs Kopf.svg', svg);
    await expect(storage.addLibrarySvg('X', 'a', 'hallo')).rejects.toThrow();
    await expect(storage.addLibrarySvg('X', 'a', '<svg><script>1</script></svg>')).rejects.toThrow();
    const themes = await storage.listLibrary(); // fetch auf library/index.json schlägt in Node fehl -> nur eigene
    const t = themes.find((x) => x.name === 'Tiere');
    expect(t?.icon).toBe('🐾');
    expect(t?.files[0].name).toBe('Fuchs_Kopf');
    expect(await t!.files[0].load()).toBe(svg);
    expect(t!.files[0].thumb.startsWith('data:image/svg+xml')).toBe(true);
  });
});

describe('Namen', () => {
  it('bildet Dateinamen <Kind>_<Datum>_<Uhrzeit>.svg', () => {
    expect(exportFileName('Ana Lena!', new Date(2026, 9, 25, 8, 5, 9))).toBe('Ana_Lena_2026-10-25_08-05-09.svg');
    expect(safeName('../../x')).toBe('x');
    expect(safeName('')).toBe('Kind');
    expect(splitThemeName('🐾 Tiere')).toEqual({ icon: '🐾', name: 'Tiere' });
    expect(splitThemeName('Tiere')).toEqual({ icon: '🖼️', name: 'Tiere' });
  });
});

describe('ZIP', () => {
  it('berechnet die CRC32 korrekt', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('schreibt eine lesbare ZIP-Struktur', () => {
    const zip = makeZip([
      { name: 'Lena/a.svg', data: new TextEncoder().encode('<svg/>'), date: new Date(2026, 9, 25, 10, 0, 0) },
      { name: 'Tom/ü.svg', data: new TextEncoder().encode('xyz') },
    ]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    expect(v.getUint16(eocd + 10, true)).toBe(2);
    const cdOffset = v.getUint32(eocd + 16, true);
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50);
    expect(v.getUint32(cdOffset + 16, true)).toBe(crc32(new TextEncoder().encode('<svg/>')));
    const nameLen = v.getUint16(cdOffset + 28, true);
    expect(new TextDecoder().decode(zip.slice(cdOffset + 46, cdOffset + 46 + nameLen))).toBe('Lena/a.svg');
  });

  it('packt je Kind einen Ordner und überspringt leere Arbeiten', () => {
    const el = makeElement({ kind: 'shape', ref: 'circle', rings: baseShape('circle'), op: 'cut', size: 40, x: 50, y: 50 });
    const t = new Date(2026, 9, 25, 9, 0, 0).getTime();
    const zip = buildZip(
      [
        { ...createDesign(), id: 'a', profile: 'Lena', updated: t, elements: [el] },
        { ...createDesign(), id: 'b', profile: 'Lena', updated: t, elements: [el] },
        { ...createDesign(), id: 'c', profile: 'Lena', updated: t, elements: [] },
      ],
      [{ id: 'Lena', name: 'Lena' }],
      DEFAULT_SETTINGS,
    );
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('Lena/Lena_2026-10-25_09-00-00.svg');
    expect(text).toContain('Lena/Lena_2026-10-25_09-00-00_2.svg');
    expect(text).not.toContain('_3.svg');
  });
});
