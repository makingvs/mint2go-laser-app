import { describe, expect, it } from 'vitest';
import { nodeToShape, parsePath, parseTransform, type SvgNode } from '../src/svgImport';
import { bbox, pointInShape, shapeArea } from '../src/geometry';

const n = (tag: string, attrs: Record<string, string> = {}, children: SvgNode[] = []): SvgNode => ({ tag, attrs, children });
const svg = (...children: SvgNode[]) => n('svg', {}, children);

describe('parsePath', () => {
  it('liest absolute und relative Linien, H, V und Z', () => {
    const [r] = parsePath('M10 10 H30 v20 L10 30 z');
    expect(r).toEqual([[10, 10], [30, 10], [30, 30], [10, 30]]);
  });

  it('zerlegt Teilpfade, relatives m geht vom Startpunkt des geschlossenen Teilpfads aus', () => {
    const subs = parsePath('M10 10 h20 v20 z m5 5 h10 v10 z');
    expect(subs).toHaveLength(2);
    expect(subs[1][0]).toEqual([15, 15]);
  });

  it('behandelt weitere Paare nach M als Linien und kompakte Zahlen', () => {
    const [r] = parsePath('M0,0 10,0 10-10-1e1 0');
    expect(r).toEqual([[0, 0], [10, 0], [10, -10], [-10, 0]]);
  });

  it('zerlegt Kurven fein und endet exakt im Zielpunkt', () => {
    const [r] = parsePath('M0 0 C0 10 10 10 10 0 S20 -10 20 0 Q25 10 30 0 T40 0');
    expect(r.length).toBeGreaterThan(60);
    expect(r[r.length - 1]).toEqual([40, 0]);
  });

  it('rechnet Bögen (auch mit kompakten Flags) in Punkte um', () => {
    const [r] = parsePath('M0 0 a10 10 0 0110 10');
    const b = bbox([r]);
    expect(r[r.length - 1][0]).toBeCloseTo(10, 6);
    expect(r[r.length - 1][1]).toBeCloseTo(10, 6);
    expect(Math.max(b.maxX - b.minX, b.maxY - b.minY)).toBeGreaterThanOrEqual(10);
    // Viertelkreis um (0,10): alle Punkte haben Abstand 10 vom Mittelpunkt
    for (const [x, y] of r) expect(Math.hypot(x - 0, y - 10)).toBeCloseTo(10, 4);
  });

  it('bricht bei kaputten Daten sauber ab', () => {
    expect(parsePath('Q')).toEqual([]);
    expect(parsePath('hallo')).toEqual([]);
  });
});

describe('parseTransform', () => {
  it('verkettet translate, scale und rotate um einen Punkt', () => {
    expect(parseTransform('translate(10 20) scale(2)')).toEqual([2, 0, 0, 2, 10, 20]);
    const m = parseTransform('rotate(90 10 10)');
    // Punkt (20,10) wird um (10,10) zu (10,20)
    expect(m[0] * 20 + m[2] * 10 + m[4]).toBeCloseTo(10, 9);
    expect(m[1] * 20 + m[3] * 10 + m[5]).toBeCloseTo(20, 9);
  });
});

describe('nodeToShape', () => {
  it('liefert für Formen mit Loch (evenodd per Teilpfade) ein Loch', () => {
    const shape = nodeToShape(svg(n('path', { d: 'M0 0H100V100H0Z M30 30H70V70H30Z' })));
    expect(shape).toHaveLength(2);
    expect(pointInShape([50, 50], shape)).toBe(false);
    expect(pointInShape([10, 10], shape)).toBe(true);
  });

  it('vereint Stamm und Krone mit gemeinsamer Kante zu einem Umriss', () => {
    const tree = svg(
      n('g', { transform: 'translate(0 4)' }, [
        n('polygon', { points: '50,2 90,88 10,88' }),
        n('rect', { x: '44', y: '88', width: '12', height: '10' }),
      ]),
    );
    const shape = nodeToShape(tree);
    expect(shape).toHaveLength(1);
  });

  it('vereint überlappende Formen und ignoriert Weiß, none und display:none', () => {
    const shape = nodeToShape(
      svg(
        n('rect', { x: '0', y: '0', width: '200', height: '200', fill: '#fff' }),
        n('circle', { cx: '60', cy: '50', r: '40' }),
        n('circle', { cx: '100', cy: '50', r: '40', style: 'fill:#123456' }),
        n('rect', { width: '500', height: '500', fill: 'none' }),
        n('rect', { width: '500', height: '500', style: 'display:none' }),
        n('text', {}, []),
      ),
    );
    expect(shape).toHaveLength(1);
    const b = bbox(shape);
    expect(b.maxX - b.minX).toBeCloseTo(100, 0); // auf 0..100 skaliert
    expect(shapeArea(shape)).toBeGreaterThan(0);
  });

  it('liefert für leere oder reine Hintergrund-SVGs nichts', () => {
    expect(nodeToShape(svg())).toEqual([]);
    expect(nodeToShape(svg(n('rect', { width: '10', height: '10', fill: 'white' })))).toEqual([]);
  });

  it('versteht abgerundete Rechtecke', () => {
    const shape = nodeToShape(svg(n('rect', { width: '100', height: '50', rx: '10' })));
    expect(shape).toHaveLength(1);
    expect(shape[0].length).toBeGreaterThan(8);
  });
});
