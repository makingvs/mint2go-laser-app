// SVG-Export für xTool Creative Space: Maße in mm, nur Pfade, feste Farben je Bearbeitungsart.
import { featureSize, removeDoubledLines, ringToPath, unionShapes, type Polyline, type Shape } from './geometry';
import { worldShape, type Design, type El, type Op, type Settings } from './model';
import { exportFrame } from './surface';

const LAYER_ID: Record<Op, string> = { cut: 'schneiden', engrave: 'gravieren', fill: 'flaechengravur' };

function fmt(n: number): string {
  return String(+n.toFixed(3));
}

/** Linie ohne nennenswerte Fläche (mm): lässt sich nicht füllen, wird als Linie graviert */
const MIN_FILL_WIDTH = 0.3;

/**
 * Pfaddaten je Bearbeitungsart. Schneiden/Gravieren: jede Linie, die man auf der Fläche sieht, kommt in die Datei
 * (auch Formen in Formen, z. B. Löcher, und Überschneidungen); nur genau doppelte Linienstücke entfallen.
 * Flächengravur: gleiche Art wird vereinigt, sonst würden sich Überlappungen gegenseitig auslöschen.
 */
export function buildPaths(elements: El[]): Record<Op, { closed: Shape; open: [number, number][][] }> {
  const lines: Record<'cut' | 'engrave', Polyline[]> = { cut: [], engrave: [] };
  const fills: Shape[] = [];
  for (const e of elements) {
    const ws = worldShape(e);
    if (e.op === 'fill') {
      if (e.open && featureSize(ws) < MIN_FILL_WIDTH) for (const r of ws) lines.engrave.push({ pts: r, closed: false });
      else fills.push(ws); // Flächengravur nur für geschlossene Formen: offene Linien werden geschlossen.
    } else {
      for (const r of ws) lines[e.op].push({ pts: r, closed: !e.open });
    }
  }
  const split = (list: Polyline[]) => {
    const kept = removeDoubledLines(list);
    return { closed: kept.filter((l) => l.closed).map((l) => l.pts), open: kept.filter((l) => !l.closed).map((l) => l.pts) };
  };
  return { cut: split(lines.cut), engrave: split(lines.engrave), fill: { closed: unionShapes(fills), open: [] } };
}

export function exportSvg(design: Pick<Design, 'elements' | 'surface'>, settings: Settings): string {
  // Größe der Datei = Zeichenfläche (Werkstück) bzw. bei unendlicher Fläche der Inhalt
  const frame = exportFrame(design, settings);
  const width = frame.w;
  const height = frame.h;
  const els = frame.dx || frame.dy ? design.elements.map((e) => ({ ...e, x: e.x + frame.dx, y: e.y + frame.dy })) : design.elements;
  const paths = buildPaths(els);
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}mm" height="${fmt(height)}mm" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`);

  const stroke = (op: 'cut' | 'engrave') => {
    const color = settings.colors[op];
    const { closed, open } = paths[op];
    const d = closed.map((r) => ringToPath(r)).join('') + open.map((r) => ringToPath(r, false)).join('');
    if (d) lines.push(`  <path id="${LAYER_ID[op]}" d="${d}" fill="none" stroke="${color}" stroke-width="0.1"/>`);
  };
  stroke('cut');
  stroke('engrave');
  const fill = paths.fill.closed;
  if (fill.length) {
    const d = fill.map((r) => ringToPath(r)).join('');
    lines.push(`  <path id="${LAYER_ID.fill}" d="${d}" fill="${settings.colors.fill}" fill-rule="evenodd" stroke="none"/>`);
  }
  lines.push('</svg>');
  return lines.join('\n') + '\n';
}
