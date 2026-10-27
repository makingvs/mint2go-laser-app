import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeElement, type El, type Op } from '../src/model';
import { baseShape } from '../src/shapes';
import { nodeToTemplate, type SvgNode } from '../src/svgImport';
import { ellipseSurface, rectSurface } from '../src/surface';
import { firstOpenStep, type Snapshot } from '../src/guided/engine';
import { LEVELS, MATERIAL, PROJECTS, projectByNumber } from '../src/guided/projects';

// ---------- kleine XML-Zerlegung für die Vorlagen (der Test läuft ohne DOM) ----------
function parseSvg(text: string): SvgNode {
  const root: SvgNode = { tag: '#root', attrs: {}, children: [] };
  const stack: SvgNode[] = [root];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const [, close, tag, rawAttrs, self] = m;
    if (close) {
      stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = a[2] ?? a[3];
    const node: SvgNode = { tag: tag.toLowerCase(), attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!self) stack.push(node);
  }
  return root.children[0];
}

const snap = (elements: El[], over: Partial<Snapshot> = {}): Snapshot => ({
  elements,
  selected: null,
  surface: rectSurface(200, 120),
  exported: false,
  thin: () => false,
  outside: () => false,
  ...over,
});

const shape = (id: Parameters<typeof baseShape>[0], x: number, y: number, w: number, h: number, op: Op = 'cut'): El => ({
  ...makeElement({ kind: 'shape', ref: id, rings: baseShape(id), op, size: Math.max(w, h), x, y, exact: { w, h } }),
});
const box = (kind: El['kind'], ref: string, x: number, y: number, w: number, h: number, op: Op, open?: boolean): El =>
  makeElement({ kind, ref, rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]], op, size: Math.max(w, h), x, y, exact: { w, h }, open });

describe('Laser-Werkstatt: Projektdaten', () => {
  it('hat 20 Projekte, 5 je Stufe, lückenlos nummeriert', () => {
    expect(PROJECTS.map((p) => p.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const lv of [1, 2, 3, 4]) expect(PROJECTS.filter((p) => p.lv === lv).length).toBe(5);
    expect(Object.keys(LEVELS)).toHaveLength(4);
  });

  it('jedes Projekt ist vollständig und endet mit Export/Laser/Basteln', () => {
    for (const p of PROJECTS) {
      expect(p.title, `Titel ${p.n}`).toBeTruthy();
      expect(MATERIAL[p.mat], `Material ${p.n}`).toBeTruthy();
      expect(p.steps.length, `Schritte ${p.n}`).toBeGreaterThanOrEqual(5);
      expect(p.ich).toHaveLength(4);
      expect(p.lp.e.length).toBeGreaterThan(0);
      expect(p.steps.some((s) => s.title === 'Abschicken'), `Export ${p.n}`).toBe(true);
      for (const s of p.steps) {
        expect(s.icon && s.title && s.text, `Schritt in ${p.n}`).toBeTruthy();
        // Schritte mit Hilfe-Taste "Vorlage" nur, wenn das Projekt eine Vorlage hat
        if (s.action === 'template') expect(p.template, `Vorlage ${p.n}`).toBeTruthy();
      }
      if (p.surface) {
        expect(p.surface.w).toBeGreaterThan(0);
        expect(p.surface.h).toBeGreaterThan(0);
      }
    }
  });

  it('Bilder und Vorlagen sind vorhanden', () => {
    for (const p of PROJECTS) {
      expect(existsSync(`public/werkstatt/pics/${String(p.n).padStart(2, '0')}.jpg`), `Bild ${p.n}`).toBe(true);
      if (p.template) expect(existsSync(`public/${p.template}`), `Vorlage ${p.n}`).toBe(true);
    }
    expect(PROJECTS.filter((p) => p.template).map((p) => p.n)).toEqual([14, 17, 19, 20]);
  });

  it('Farben der Vorlagen: Rot = Schneiden, Blau = Gravieren', () => {
    for (const p of PROJECTS.filter((x) => x.template)) {
      const t = nodeToTemplate(parseSvg(readFileSync(`public/${p.template}`, 'utf8')));
      expect(t.parts.length, `Teile ${p.n}`).toBeGreaterThan(1);
      expect(t.parts.some((x) => x.op === 'cut')).toBe(true);
      // Vorlagengröße entspricht der Voreinstellung der Zeichenfläche
      expect(t.w).toBeCloseTo(p.surface!.w, 0);
      expect(t.h).toBeCloseTo(p.surface!.h, 0);
      for (const part of t.parts) {
        expect(part.rings.length).toBeGreaterThan(0);
        for (const r of part.rings) for (const [x, y] of r) {
          expect(x).toBeGreaterThanOrEqual(-1);
          expect(x).toBeLessThanOrEqual(t.w + 1);
          expect(y).toBeGreaterThanOrEqual(-1);
          expect(y).toBeLessThanOrEqual(t.h + 1);
        }
      }
    }
    const lantern = nodeToTemplate(parseSvg(readFileSync('public/werkstatt/vorlagen/19_Laterne.svg', 'utf8')));
    expect(lantern.parts.some((x) => x.op === 'engrave')).toBe(true);
  });
});

describe('Laser-Werkstatt: Prüfungen', () => {
  it('Türschild: Schritt für Schritt', () => {
    const p = projectByNumber(1)!;
    const sign = shape('roundrect', 100, 60, 120, 60, 'engrave');
    const name = box('text', 'ANNA', 100, 60, 60, 20, 'fill');
    const star = shape('star', 40, 60, 14, 14, 'fill');
    const open = (i: number, els: El[], over: Partial<Snapshot> = {}) => firstOpenStep(p, snap(els, over)) === i;
    expect(open(0, [])).toBe(true);
    expect(open(1, [shape('roundrect', 100, 60, 50, 50)])).toBe(true);
    expect(open(2, [sign])).toBe(true);
    expect(open(3, [sign, box('text', 'ANNA', 10, 10, 60, 20, 'fill')])).toBe(true);
    expect(open(4, [sign, name])).toBe(true);
    expect(open(5, [sign, name, star])).toBe(true);
    sign.op = 'cut';
    expect(open(6, [sign, name, star])).toBe(true);
    expect(open(7, [sign, name, star], { exported: true })).toBe(true);
  });

  it('Untersetzer: Kreis-Fläche und Muster im Kreis', () => {
    const p = projectByNumber(4)!;
    expect(p.steps[0].check!(snap([], { surface: rectSurface(100, 100) }))).toBe(false);
    expect(p.steps[0].check!(snap([], { surface: ellipseSurface(100, 100) }))).toBe(true);
    const els = [shape('star', 30, 40, 10, 10, 'fill'), shape('heart', 60, 50, 30, 30, 'fill'), shape('star', 50, 70, 8, 8, 'fill'), shape('flower', 70, 30, 12, 12, 'fill')];
    expect(p.steps[1].check!(snap(els))).toBe(true);
    expect(p.steps[2].check!(snap(els))).toBe(true);
    expect(p.steps[3].check!(snap(els, { outside: (e) => e === els[0] }))).toBe(false);
  });

  it('Taschen-Anhänger: Loch muss im Tier liegen', () => {
    const p = projectByNumber(2)!;
    const animal = box('graphic', 'iconify:fluent-emoji:cat', 60, 50, 60, 55, 'cut');
    const hole = shape('circle', 60, 30, 5, 5);
    expect(p.steps[2].check!(snap([animal, shape('circle', 150, 30, 5, 5)]))).toBe(false);
    expect(p.steps[2].check!(snap([animal, hole]))).toBe(true);
    // Loch zu dicht am Rand zählt (noch) mit, aber zu groß nicht
    expect(p.steps[2].check!(snap([animal, shape('circle', 60, 30, 9, 9)]))).toBe(false);
  });

  it('Fensterbild: Symmetrie', () => {
    const p = projectByNumber(12)!;
    const big = shape('circle', 80, 80, 120, 120);
    const mk = (x: number, y: number) => shape('star', x, y, 14, 14);
    const pairs = [mk(50, 50), mk(110, 50), mk(40, 90), mk(120, 90), mk(60, 120), mk(100, 120)];
    expect(p.steps[2].check!(snap([big, ...pairs]))).toBe(true);
    expect(p.steps[2].check!(snap([big, ...pairs.slice(0, 5), mk(70, 150)]))).toBe(false);
    expect(p.steps[3].check!(snap([big], { surface: rectSurface(160, 160) }))).toBe(true);
  });

  it('Lederarmband: Streifen, vier Löcher, Name', () => {
    const p = projectByNumber(9)!;
    const strip = shape('rectangle', 100, 20, 170, 18);
    const holes = [shape('circle', 22, 14, 4, 4), shape('circle', 22, 26, 4, 4), shape('circle', 178, 14, 4, 4), shape('circle', 178, 26, 4, 4)];
    expect(p.steps[1].check!(snap([strip]))).toBe(true);
    expect(p.steps[2].check!(snap([strip, ...holes.slice(0, 3)]))).toBe(false);
    expect(p.steps[2].check!(snap([strip, ...holes]))).toBe(true);
  });

  it('Puzzle: offene Linien von Rand zu Rand', () => {
    const p = projectByNumber(11)!;
    const plate = shape('rectangle', 70, 55, 120, 90);
    const lines = [0, 1, 2].map((i) => box('free', 'free', 40 + i * 30, 55, 4, 100, 'cut', true));
    expect(p.steps[2].check!(snap([plate, ...lines.slice(0, 2)]))).toBe(false);
    expect(p.steps[2].check!(snap([plate, ...lines]))).toBe(true);
  });

  it('Export-Schritt braucht einen Export in dieser Sitzung', () => {
    for (const p of PROJECTS) {
      const step = p.steps.find((s) => s.title === 'Abschicken')!;
      expect(step.check!(snap([]))).toBe(false);
      expect(step.check!(snap([], { exported: true }))).toBe(true);
    }
  });
});
