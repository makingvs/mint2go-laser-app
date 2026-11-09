import { describe, expect, it } from 'vitest';
import { textShape } from '../src/text';
import {
  BASE_DIAMETER,
  BASE_HEIGHT,
  FIGURE_MAX_HEIGHT,
  figureCheck,
  findOverhangs,
  isBase,
  makeBase,
  makeFigureKind,
  maxHeightAt,
  newFigureParts,
  resizeBase,
} from '../app3d/src/figure';
import { PART_KINDS } from '../app3d/src/mesh';
import { buildZip3d, createFigureDesign, packDesign } from '../app3d/src/designIO';
import { makeOutlinePart, newId, type Part } from '../app3d/src/model3d';
import { buildFinal, type FinalModel } from '../app3d/src/printExport';
import { restOn } from '../app3d/src/support';
import { FIGURE_BED } from '../app3d/src/figure';

const NOZZLE = 0.4;

/** Körper in der Mitte des Sockels auf das legen, was darunter ist (wie der Editor). */
const onBase = (p: Part, parts: Part[], x = 0, y = 0): Part => restOn({ ...p, x, y }, parts);

async function check(parts: Part[]) {
  const model = (await buildFinal(parts)) as FinalModel;
  return { model, c: figureCheck(parts, model, NOZZLE) };
}

describe('Sockel', () => {
  it('Standard: Ø 25 mm, 3 mm dick, steht auf dem Bett', () => {
    const [b] = newFigureParts();
    expect(isBase(b)).toBe(true);
    expect([b.w, b.d, b.h, b.x, b.y, b.z]).toEqual([BASE_DIAMETER, BASE_DIAMETER, BASE_HEIGHT, 0, 0, 0]);
    expect(BASE_DIAMETER).toBe(25);
  });

  it('Durchmesser ändern bleibt rund und begrenzt', () => {
    const b = makeBase();
    expect(resizeBase(b, 30)).toMatchObject({ w: 30, d: 30, h: BASE_HEIGHT });
    expect(resizeBase(b, 2).w).toBe(15);
    expect(resizeBase(b, 99).d).toBe(40);
  });

  it('Grundkörper in Figur-Größe passen auf den Sockel', () => {
    for (const k of PART_KINDS) {
      const p = makeFigureKind(k);
      expect(Math.max(p.w, p.d)).toBeLessThanOrEqual(BASE_DIAMETER);
      expect(p.h).toBeLessThanOrEqual(FIGURE_MAX_HEIGHT - BASE_HEIGHT);
    }
  });

  it('Höchste Höhe richtet sich nach dem Boden des Körpers', () => {
    expect(maxHeightAt(3)).toBe(27);
    expect(maxHeightAt(20)).toBe(10);
    expect(maxHeightAt(29.9)).toBe(2);
  });
});

describe('Überhang', () => {
  it('senkrechte Wände und flache Oberseiten sind kein Überhang', async () => {
    const parts = newFigureParts();
    const { model } = await check([...parts, onBase(makeFigureKind('box'), parts)]);
    expect(findOverhangs(model)).toHaveLength(0);
  });

  it('Kegel mit der Spitze nach oben ist kein Überhang', async () => {
    const parts = newFigureParts();
    const { c } = await check([...parts, onBase(makeFigureKind('cone'), parts)]);
    expect(c.overhang).toBe(false);
  });

  it('breite Platte auf schmalem Hals: Überhang zu groß, der Körper wird genannt', async () => {
    const base = newFigureParts();
    const neck = onBase({ ...makeFigureKind('cylinder'), w: 6, d: 6, h: 8 }, base);
    const withNeck = [...base, neck];
    const hat = onBase({ ...makeFigureKind('cylinder'), w: 20, d: 20, h: 4 }, withNeck);
    const { model, c } = await check([...withNeck, hat]);
    const spots = findOverhangs(model);
    expect(spots.length).toBeGreaterThan(0);
    expect(Math.max(...spots.map((s) => s.reach))).toBeGreaterThan(10);
    expect(c.overhang).toBe(true);
    expect(c.overhangParts).toEqual([hat.id]);
    expect(c.ok).toBe(false);
  });

  it('kleiner Überhang (bis 5 mm Ausladung) ist erlaubt', async () => {
    const base = newFigureParts();
    const neck = onBase({ ...makeFigureKind('cylinder'), w: 8, d: 8, h: 6 }, base);
    const withNeck = [...base, neck];
    const cap = onBase({ ...makeFigureKind('cylinder'), w: 12, d: 12, h: 3 }, withNeck); // 2 mm ringsum
    const { c } = await check([...withNeck, cap]);
    expect(c.overhang).toBe(false);
  });

  it('große Kugel auf dem Sockel hat unten einen zu großen Überhang, eingesunken nicht mehr', async () => {
    const base = newFigureParts();
    const ball = onBase({ ...makeFigureKind('sphere'), w: 14, d: 14, h: 14 }, base);
    expect((await check([...base, ball])).c.overhang).toBe(true);
    const sunk = { ...ball, z: BASE_HEIGHT - 5 };
    expect((await check([...base, sunk])).c.overhang).toBe(false);
  });

  it('Teil über den Sockelrand hinaus ist ein Überhang', async () => {
    const base = newFigureParts();
    const plate = onBase({ ...makeFigureKind('box'), w: 12, d: 12, h: 4 }, base, 16, 0); // ragt weit über den Rand
    const { c } = await check([...base, plate]);
    expect(c.overhang).toBe(true);
  });
});

describe('Figur in Arbeit und ZIP', () => {
  const printer = { bed: { width: 220, depth: 220, height: 250 }, nozzle: NOZZLE };
  const profiles = [{ id: 'k1', name: 'Anna' }];

  it('Spielfigur-Kennzeichen bleibt beim Speichern erhalten', () => {
    const d = createFigureDesign();
    expect(d.figure).toBe(true);
    expect(d.parts).toHaveLength(1);
    const saved = packDesign({ id: d.id, created: d.created, figure: d.figure }, d.parts);
    expect(saved.figure).toBe(true);
    expect(packDesign({ id: 'x', created: 1 }, []).figure).toBeUndefined();
  });

  it('ZIP: Figuren, die die Prüfung nicht bestehen, werden übersprungen', async () => {
    const base = newFigureParts();
    const good = [...base, onBase(makeFigureKind('cylinder'), base)];
    const tall = [...base, onBase({ ...makeFigureKind('cylinder'), h: 28 }, base)];
    const mk = (parts: Part[], figure: boolean) => ({ ...packDesign({ id: newId(), created: 1, figure: figure ? (true as const) : undefined }, parts), profile: 'k1' });
    const zip = await buildZip3d([mk(good, true), mk(tall, true)], profiles, printer, 'stl');
    expect(zip).not.toBeNull();
    expect([...Buffer.from(zip!).toString('latin1').matchAll(/Anna\/Anna_[^/]*\.stl/g)]).toHaveLength(2); // lokaler Eintrag + Verzeichnis = 1 Datei
    // dieselbe zu hohe Figur als normale Arbeit (kein Figur-Modus) wird exportiert
    const normal = await buildZip3d([mk(tall, true)], profiles, printer, 'stl');
    expect(normal).toBeNull();
    const plain = await buildZip3d([mk(tall, false)], profiles, printer, 'stl');
    expect(plain).not.toBeNull();
  });
});

describe('Druckprüfung der Figur', () => {
  it('nur Sockel: noch nichts darauf', async () => {
    const { c } = await check(newFigureParts());
    expect(c.onlyBase).toBe(true);
    expect(c.ok).toBe(false);
  });

  it('einfache Figur (Körper + Kopf) ist in Ordnung', async () => {
    const base = newFigureParts();
    const body = onBase(makeFigureKind('cylinder'), base);
    const withBody = [...base, body];
    const head = onBase({ ...makeFigureKind('cone'), w: 8, d: 8, h: 8 }, withBody);
    const { c } = await check([...withBody, head]);
    expect(c).toMatchObject({ onlyBase: false, outside: false, tooTall: false, overhang: false, loose: false, ok: true });
  });

  it('höher als 30 mm: zu hoch', async () => {
    const base = newFigureParts();
    const tall = onBase({ ...makeFigureKind('cylinder'), h: 28 }, base); // 3 + 28 = 31
    const { c } = await check([...base, tall]);
    expect(c.tooTall).toBe(true);
    expect(c.ok).toBe(false);
    const fine = onBase({ ...makeFigureKind('cylinder'), h: 27 }, base); // genau 30
    expect((await check([...base, fine])).c.tooTall).toBe(false);
  });

  it('Teil schwebt oder liegt getrennt neben dem Sockel: lose', async () => {
    const base = newFigureParts();
    const floating = { ...makeFigureKind('box'), z: 15 };
    expect((await check([...base, floating])).c.loose).toBe(true);
    const beside = { ...makeFigureKind('box'), x: 22, y: 0, z: 0 };
    expect((await check([...base, beside])).c.loose).toBe(true);
  });

  it('zu breit für die Arbeitsfläche', async () => {
    const base = newFigureParts();
    const wide = onBase({ ...makeFigureKind('box'), w: 80, d: 12, h: 4 }, base);
    const { c } = await check([...base, wide]);
    expect(c.outside).toBe(true);
    expect(FIGURE_BED.width).toBe(60);
  });

  it('einzelner Buchstabe auf dem Sockel ist druckbar', async () => {
    const base = newFigureParts();
    const letter = makeOutlinePart(textShape('A'), { scale: 15 / 7 }, 8, FIGURE_BED, 0, 0, 'text')!;
    const { c } = await check([...base, onBase(letter, base)]);
    expect(c).toMatchObject({ overhang: false, loose: false, tooTall: false, outside: false });
    expect(c.ok).toBe(true);
  });

  it('Löcher zählen nicht als Teil der Figur', async () => {
    const base = newFigureParts();
    const hole = { ...onBase(makeFigureKind('box'), base), hole: true };
    const { c } = await check([...base, hole]);
    expect(c.onlyBase).toBe(true);
  });
});
